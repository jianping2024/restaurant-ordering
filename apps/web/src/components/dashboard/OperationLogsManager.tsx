'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DatePicker } from '@mesa/ui';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { ListPaginationBar } from '@/components/ui/ListPaginationBar';
import { showToast } from '@/components/ui/Toast';
import { OPERATION_LOG_ACTION_TYPES, type OperationLogActionType } from '@/lib/audit/types';
import {
  addCalendarDays,
  calendarDateInTimezone,
} from '@/lib/lisbon-calendar';
import { fetchOperationLogs } from '@/lib/operation-logs/client-api';
import {
  formatOperationLogDetail,
  operationLogActionLabel,
  operationLogTableLabel,
} from '@/lib/operation-logs/detail-text';
import type { OperationLogsListResult } from '@/lib/operation-logs/query';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import {
  LIST_DEFAULT_PAGE_SIZE,
  type ListPageSize,
} from '@/lib/paginate-list';

const REFRESH_COOLDOWN_MS = 60_000;
const FILTER_DEBOUNCE_MS = 500;

type Filters = {
  startDate: string;
  endDate: string;
  actionType: OperationLogActionType | '';
};

type DatePreset = 'today' | 'last7' | 'last30';

const DEFAULT_FILTERS = (today: string): Filters => ({
  startDate: today,
  endDate: today,
  actionType: '',
});

function detectDatePreset(
  startDate: string,
  endDate: string,
  today: string,
): DatePreset | null {
  if (startDate === today && endDate === today) return 'today';
  if (startDate === addCalendarDays(today, -6) && endDate === today) return 'last7';
  if (startDate === addCalendarDays(today, -29) && endDate === today) return 'last30';
  return null;
}

const COMPACT_SELECT_CLASS =
  'rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-base text-brand-text';const DATE_PICKER_TRIGGER_CLASS =
  'w-full rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-left text-base text-brand-text transition-colors hover:border-brand-gold/40 focus:outline-none focus:ring-2 focus:ring-brand-gold/35';
const PRESET_BTN_BASE =
  'text-[13px] px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap';

export function OperationLogsManager() {
  const { lang } = useLanguage();
  const messages = getMessages(lang);
  const t = messages.operationLogs;
  const pickDate = messages.buffetAdmin.pickDate;
  const locale = UI_LOCALE_BY_LANG[lang];
  const today = useMemo(() => calendarDateInTimezone(new Date()), []);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS(today));
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<ListPageSize>(LIST_DEFAULT_PAGE_SIZE);
  const [data, setData] = useState<OperationLogsListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshCooldownSec, setRefreshCooldownSec] = useState(0);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFilters(filters), FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    if (refreshCooldownSec <= 0) return;
    const timer = window.setTimeout(() => {
      setRefreshCooldownSec((sec) => Math.max(0, sec - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [refreshCooldownSec]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchOperationLogs({
      startDate: debouncedFilters.startDate,
      endDate: debouncedFilters.endDate,
      actionType: debouncedFilters.actionType || undefined,
      page,
      pageSize,
    });
    setLoading(false);
    if (!result.ok) {
      showToast(t.actionFailed, 'error');
      return;
    }
    setData(result.data);
  }, [debouncedFilters, page, pageSize, t.actionFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = () => {
    const now = Date.now();
    const elapsed = now - lastRefreshAtRef.current;
    if (lastRefreshAtRef.current > 0 && elapsed < REFRESH_COOLDOWN_MS) {
      setRefreshCooldownSec(Math.ceil((REFRESH_COOLDOWN_MS - elapsed) / 1000));
      return;
    }
    lastRefreshAtRef.current = now;
    setRefreshCooldownSec(Math.ceil(REFRESH_COOLDOWN_MS / 1000));
    void load();
  };

  const activeDatePreset = detectDatePreset(filters.startDate, filters.endDate, today);

  const applyDatePreset = (preset: DatePreset) => {
    const next =
      preset === 'today'
        ? { startDate: today, endDate: today }
        : preset === 'last7'
          ? { startDate: addCalendarDays(today, -6), endDate: today }
          : { startDate: addCalendarDays(today, -29), endDate: today };
    setPage(1);
    setFilters((prev) => ({ ...prev, ...next }));
  };

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const presetBtnClass = (active: boolean) =>
    `${PRESET_BTN_BASE} ${
      active
        ? 'border-brand-gold bg-brand-gold/10 text-brand-text'
        : 'border-brand-border text-brand-text-muted hover:border-brand-gold/40 hover:text-brand-text'
    }`;

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={presetBtnClass(activeDatePreset === 'today')} onClick={() => applyDatePreset('today')}>
          {t.dateToday}
        </button>
        <button type="button" className={presetBtnClass(activeDatePreset === 'last7')} onClick={() => applyDatePreset('last7')}>
          {t.dateLast7}
        </button>
        <button type="button" className={presetBtnClass(activeDatePreset === 'last30')} onClick={() => applyDatePreset('last30')}>
          {t.dateLast30}
        </button>
        <DatePicker
          className="w-[10.5rem]"
          triggerClassName={DATE_PICKER_TRIGGER_CLASS}
          value={filters.startDate}
          onChange={(iso) => updateFilter('startDate', iso || today)}
          lang={lang}
          max={today}
          placeholder={pickDate}
        />
        <span className="text-brand-text-muted">—</span>
        <DatePicker
          className="w-[10.5rem]"
          triggerClassName={DATE_PICKER_TRIGGER_CLASS}
          value={filters.endDate}
          onChange={(iso) => updateFilter('endDate', iso || today)}
          lang={lang}
          max={today}
          placeholder={pickDate}
        />
        <select
          className={COMPACT_SELECT_CLASS}
          value={filters.actionType}
          onChange={(e) =>
            updateFilter('actionType', (e.target.value || '') as Filters['actionType'])
          }
        >
          <option value="">{t.typeAll}</option>
          {OPERATION_LOG_ACTION_TYPES.map((key) => (
            <option key={key} value={key}>
              {operationLogActionLabel(lang, key)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshCooldownSec > 0}
        >
          {refreshCooldownSec > 0 ? t.refreshCooldown.replace('{n}', String(refreshCooldownSec)) : t.refresh}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-brand-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-bg/60 text-brand-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t.colTime}</th>
              <th className="px-3 py-2 font-medium">{t.colAction}</th>
              <th className="px-3 py-2 font-medium">{t.colOperator}</th>
              <th className="px-3 py-2 font-medium">{t.colTable}</th>
              <th className="px-3 py-2 font-medium">{t.colDetail}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-brand-text-muted">
                  {t.loading}
                </td>
              </tr>
            )}
            {!loading && (data?.items.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-brand-text-muted">
                  {t.empty}
                </td>
              </tr>
            )}
            {!loading &&
              data?.items.map((row) => (
                <tr key={row.id} className="border-t border-brand-border/70">
                  <td className="whitespace-nowrap px-3 py-2 text-brand-text-muted">
                    {new Date(row.created_at).toLocaleString(locale, {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {operationLogActionLabel(lang, row.action_type)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{row.operator_name}</td>
                  <td className="whitespace-nowrap px-3 py-2">{operationLogTableLabel(row)}</td>
                  <td className="max-w-[18rem] truncate px-3 py-2" title={formatOperationLogDetail(lang, row)}>
                    {formatOperationLogDetail(lang, row)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <ListPaginationBar
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        total={data?.total ?? 0}
        disabled={loading}
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setPage(1);
          setPageSize(next);
        }}
        labels={{
          pageInfo: t.pageInfo,
          pageSizeLabel: t.pageSizeLabel,
          pagePrev: t.pagePrev,
          pageNext: t.pageNext,
        }}
      />
    </div>
  );
}
