'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DatePicker } from '@mesa/ui';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { ListPaginationBar } from '@/components/ui/ListPaginationBar';
import { showToast } from '@/components/ui/Toast';
import {
  OPERATION_LOG_MAX_LOOKBACK_DAYS,
  OPERATION_LOG_MAX_RANGE_DAYS,
} from '@/lib/operation-logs/date-range';
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
import { type ListPageSize } from '@/lib/paginate-list';
import { useDashboardListQuery } from '@/lib/use-dashboard-list-query';

const REFRESH_COOLDOWN_MS = 60_000;

type Filters = {
  startDate: string;
  endDate: string;
  actionType: OperationLogActionType | '';
};

type DatePreset = 'today' | 'last7';

const DEFAULT_FILTERS = (today: string): Filters => ({
  startDate: addCalendarDays(today, -(OPERATION_LOG_MAX_RANGE_DAYS - 1)),
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
  return null;
}

const COMPACT_SELECT_CLASS =
  'rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-base text-brand-text';
const DATE_PICKER_TRIGGER_CLASS =
  'w-full rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-left text-base text-brand-text transition-colors hover:border-brand-gold/40 focus:outline-none focus:ring-2 focus:ring-brand-gold/35';
const PRESET_BTN_BASE =
  'text-[13px] px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap';

type Props = {
  restaurantId: string;
};

export function OperationLogsManager({ restaurantId }: Props) {
  const { lang } = useLanguage();
  const messages = getMessages(lang);
  const t = messages.operationLogs;
  const pickDate = messages.buffetAdmin.pickDate;
  const locale = UI_LOCALE_BY_LANG[lang];
  const today = useMemo(() => calendarDateInTimezone(new Date()), []);

  const fetchList = useCallback(
    async ({
      filters,
      page,
      pageSize,
      signal,
    }: {
      filters: Filters;
      page: number;
      pageSize: ListPageSize;
      signal: AbortSignal;
    }) => {
      const result = await fetchOperationLogs(
        {
          startDate: filters.startDate,
          endDate: filters.endDate,
          actionType: filters.actionType || undefined,
          page,
          pageSize,
        },
        { signal },
      );
      if (!result.ok) return result;
      return { ok: true as const, data: result.data };
    },
    [],
  );

  const {
    draftFilters,
    patchDraftFilters,
    query,
    data,
    loading,
    setPage,
    setPageSize,
    refresh,
  } = useDashboardListQuery<Filters, OperationLogsListResult>({
    initialFilters: DEFAULT_FILTERS(today),
    fetchList,
    cache: {
      scope: 'operation-logs',
      restaurantId,
      today,
      rangeEndDate: (filters) => filters.endDate,
    },
    onFetchError: () => showToast(t.actionFailed, 'error'),
  });

  const [refreshCooldownSec, setRefreshCooldownSec] = useState(0);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    if (refreshCooldownSec <= 0) return;
    const timer = window.setTimeout(() => {
      setRefreshCooldownSec((sec) => Math.max(0, sec - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [refreshCooldownSec]);

  const handleRefresh = () => {
    const now = Date.now();
    const elapsed = now - lastRefreshAtRef.current;
    if (lastRefreshAtRef.current > 0 && elapsed < REFRESH_COOLDOWN_MS) {
      setRefreshCooldownSec(Math.ceil((REFRESH_COOLDOWN_MS - elapsed) / 1000));
      return;
    }
    lastRefreshAtRef.current = now;
    setRefreshCooldownSec(Math.ceil(REFRESH_COOLDOWN_MS / 1000));
    refresh();
  };

  const activeDatePreset = detectDatePreset(draftFilters.startDate, draftFilters.endDate, today);

  const applyDatePreset = (preset: DatePreset) => {
    const next =
      preset === 'today'
        ? { startDate: today, endDate: today }
        : { startDate: addCalendarDays(today, -6), endDate: today };
    patchDraftFilters(next);
  };

  const presetBtnClass = (active: boolean) =>
    `${PRESET_BTN_BASE} ${
      active
        ? 'border-brand-gold bg-brand-gold/10 text-brand-text'
        : 'border-brand-border text-brand-text-muted hover:border-brand-gold/40 hover:text-brand-text'
    }`;

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / query.pageSize));
  const lookbackMin = addCalendarDays(today, -(OPERATION_LOG_MAX_LOOKBACK_DAYS - 1));
  const startMinByEnd = addCalendarDays(draftFilters.endDate, -(OPERATION_LOG_MAX_RANGE_DAYS - 1));
  const startMin = startMinByEnd > lookbackMin ? startMinByEnd : lookbackMin;
  const startMax = draftFilters.endDate < today ? draftFilters.endDate : today;
  const endMaxByStart = addCalendarDays(draftFilters.startDate, OPERATION_LOG_MAX_RANGE_DAYS - 1);
  const endMax = endMaxByStart < today ? endMaxByStart : today;
  const showInitialLoading = loading && !data;
  const tableBusy = loading && !!data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={presetBtnClass(activeDatePreset === 'today')} onClick={() => applyDatePreset('today')}>
          {t.dateToday}
        </button>
        <button type="button" className={presetBtnClass(activeDatePreset === 'last7')} onClick={() => applyDatePreset('last7')}>
          {t.dateLast7}
        </button>
        <DatePicker
          className="w-[10.5rem]"
          triggerClassName={DATE_PICKER_TRIGGER_CLASS}
          value={draftFilters.startDate}
          onChange={(iso) => patchDraftFilters({ startDate: iso || today })}
          lang={lang}
          min={startMin}
          max={startMax}
          placeholder={pickDate}
        />
        <span className="text-brand-text-muted">—</span>
        <DatePicker
          className="w-[10.5rem]"
          triggerClassName={DATE_PICKER_TRIGGER_CLASS}
          value={draftFilters.endDate}
          onChange={(iso) => patchDraftFilters({ endDate: iso || today })}
          lang={lang}
          min={draftFilters.startDate}
          max={endMax}
          placeholder={pickDate}
        />
        <select
          className={COMPACT_SELECT_CLASS}
          value={draftFilters.actionType}
          onChange={(e) =>
            patchDraftFilters({
              actionType: (e.target.value || '') as Filters['actionType'],
            })
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
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshCooldownSec > 0}
        >
          {refreshCooldownSec > 0 ? t.refreshCooldown.replace('{n}', String(refreshCooldownSec)) : t.refresh}
        </Button>
      </div>

      <div
        className={`overflow-x-auto rounded-lg border border-brand-border ${tableBusy ? 'opacity-60' : ''}`}
        aria-busy={loading || undefined}
      >
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-bg/60 text-brand-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t.colAction}</th>
              <th className="px-3 py-2 font-medium">{t.colOperator}</th>
              <th className="px-3 py-2 font-medium">{t.colTable}</th>
              <th className="px-3 py-2 font-medium">{t.colDetail}</th>
              <th className="px-3 py-2 font-medium">{t.colTime}</th>
            </tr>
          </thead>
          <tbody>
            {showInitialLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-brand-text-muted">
                  {t.loading}
                </td>
              </tr>
            )}
            {!showInitialLoading && (data?.items.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-brand-text-muted">
                  {t.empty}
                </td>
              </tr>
            )}
            {!showInitialLoading &&
              data?.items.map((row) => (
                <tr key={row.id} className="border-t border-brand-border/60">
                  <td className="whitespace-nowrap px-3 py-2">
                    {operationLogActionLabel(lang, row.action_type)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{row.operator_name}</td>
                  <td className="whitespace-nowrap px-3 py-2">{operationLogTableLabel(row)}</td>
                  <td className="max-w-[18rem] truncate px-3 py-2" title={formatOperationLogDetail(lang, row)}>
                    {formatOperationLogDetail(lang, row)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-brand-text-muted">
                    {new Date(row.created_at).toLocaleString(locale, {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <ListPaginationBar
        page={query.page}
        totalPages={totalPages}
        total={data?.total ?? 0}
        pageSize={query.pageSize}
        labels={{
          pageInfo: t.pageInfo,
          pageSizeLabel: t.pageSizeLabel,
          pagePrev: t.pagePrev,
          pageNext: t.pageNext,
        }}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        disabled={loading}
      />
    </div>
  );
}
