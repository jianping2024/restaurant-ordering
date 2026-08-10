'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { DashboardDateRangePicker } from '@/components/ui/DashboardDateRangePicker';
import { ListPaginationBar } from '@/components/ui/ListPaginationBar';
import { showToast } from '@/components/ui/Toast';
import { OPERATION_LOG_ACTION_TYPES, type OperationLogActionType } from '@/lib/audit/types';
import { calendarDateInTimezone } from '@/lib/lisbon-calendar';
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

const DEFAULT_FILTERS = (today: string): Filters => ({
  startDate: today,
  endDate: today,
  actionType: '',
});

const COMPACT_SELECT_CLASS =
  'rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-base text-brand-text';

export function OperationLogsManager() {
  const { lang } = useLanguage();
  const t = getMessages(lang).operationLogs;
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

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <DashboardDateRangePicker
          className="w-[16rem]"
          startDate={filters.startDate}
          endDate={filters.endDate}
          onChange={({ startDate, endDate }) => {
            setPage(1);
            setFilters((prev) => ({ ...prev, startDate, endDate }));
          }}
          presets={['today', 'last7', 'last30']}
          labels={{
            filterDateRange: t.filterDateRange,
            dateToday: t.dateToday,
            dateLast7: t.dateLast7,
            dateLast30: t.dateLast30,
            resetDate: t.resetDate,
            dateRangeTooLong: t.dateRangeTooLong,
          }}
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
                <tr key={row.id} className="border-t border-brand-border/60">
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
        total={data?.total ?? 0}
        pageSize={pageSize}
        labels={{
          pageInfo: t.pageInfo,
          pageSizeLabel: t.pageSizeLabel,
          pagePrev: t.pagePrev,
          pageNext: t.pageNext,
        }}
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setPage(1);
          setPageSize(next);
        }}
        disabled={loading}
      />
    </div>
  );
}
