'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';
import {
  fetchAbnormalOperations,
  patchAbnormalOperationClient,
} from '@/lib/abnormal-operations/client-api';
import type { AbnormalOperationsListResult } from '@/lib/abnormal-operations/owner-query';
import {
  abnormalOperationTableHref,
  formatAbnormalOperationReasonText,
} from '@/lib/abnormal-operations/reason-display';
import type {
  AbnormalOperationRow,
  AbnormalOperationStatus,
  AbnormalOperationType,
  AbnormalRiskLevel,
} from '@/lib/abnormal-operations/types';
import {
  addCalendarDays,
  calendarDateInTimezone,
} from '@/lib/abnormal-operations';
import { mergePatchedAbnormalOperationRow } from '@/lib/abnormal-operations/list-patch-merge';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';

const REFRESH_COOLDOWN_MS = 60_000;
const FILTER_DEBOUNCE_MS = 500;

type Filters = {
  startDate: string;
  endDate: string;
  type: AbnormalOperationType | '';
  riskLevel: AbnormalRiskLevel | '';
  status: AbnormalOperationStatus | '';
  page: number;
};

type DatePreset = 'today' | 'last7' | 'last30';

const DEFAULT_FILTERS = (today: string): Omit<Filters, 'page'> => ({
  startDate: today,
  endDate: today,
  type: '',
  riskLevel: '',
  status: '',
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

function typeLabel(
  t: ReturnType<typeof getMessages>['abnormalOps'],
  type: AbnormalOperationType,
) {
  if (type === 'DISCOUNT_APPLIED') return t.typeDiscount;
  if (type === 'ITEM_DELETED') return t.typeItemDeleted;
  return t.typeUnpaidClose;
}

function riskLabel(t: ReturnType<typeof getMessages>['abnormalOps'], risk: AbnormalRiskLevel) {
  if (risk === 'HIGH') return t.riskHigh;
  if (risk === 'MEDIUM') return t.riskMedium;
  return t.riskLow;
}

function statusLabel(
  t: ReturnType<typeof getMessages>['abnormalOps'],
  status: AbnormalOperationStatus,
) {
  if (status === 'CONFIRMED') return t.statusConfirmed;
  if (status === 'IGNORED') return t.statusIgnored;
  return t.statusPending;
}

const COMPACT_SELECT_CLASS =
  'rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-[13px] text-brand-text';
const PRESET_BTN_BASE =
  'text-[13px] px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap';

function riskBadgeClass(risk: AbnormalRiskLevel) {
  if (risk === 'HIGH') return 'mesa-badge-danger';
  if (risk === 'MEDIUM') return 'mesa-badge-warning';
  return 'mesa-badge-success';
}

function statusBadgeClass(status: AbnormalOperationStatus) {
  if (status === 'CONFIRMED') return 'mesa-badge-success';
  if (status === 'IGNORED') return 'bg-brand-border/60 text-brand-text-muted';
  return 'mesa-badge-warning';
}

function ReasonCell({ text }: { text: string }) {
  if (!text) return <span className="text-brand-text-muted">—</span>;
  return (
    <span className="block max-w-[10rem] truncate text-[13px] text-brand-text" title={text}>
      {text}
    </span>
  );
}

type Props = {
  restaurantSlug: string;
};

export function AbnormalOperationsManager({ restaurantSlug }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).abnormalOps;
  const locale = UI_LOCALE_BY_LANG[lang];
  const today = useMemo(() => calendarDateInTimezone(new Date()), []);

  const [filters, setFilters] = useState<Filters>({
    startDate: today,
    endDate: today,
    type: '',
    riskLevel: '',
    status: '',
    page: 1,
  });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [data, setData] = useState<AbnormalOperationsListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AbnormalOperationRow | null>(null);
  const [ownerNoteDraft, setOwnerNoteDraft] = useState('');
  const [patching, setPatching] = useState(false);
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
    const result = await fetchAbnormalOperations({
      startDate: debouncedFilters.startDate,
      endDate: debouncedFilters.endDate,
      type: debouncedFilters.type || undefined,
      riskLevel: debouncedFilters.riskLevel || undefined,
      status: debouncedFilters.status || undefined,
      page: debouncedFilters.page,
      pageSize: 20,
    });
    setLoading(false);
    if (!result.ok) {
      showToast(t.actionFailed, 'error');
      return;
    }
    setData(result.data);
    setSelected((prev) => {
      if (!prev) return prev;
      return result.data.items.find((row) => row.id === prev.id) ?? prev;
    });
  }, [debouncedFilters, t.actionFailed]);

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
    setFilters((prev) => ({ ...prev, ...next, page: 1 }));
  };

  const resetFilters = () => {
    const defaults = DEFAULT_FILTERS(today);
    setFilters((prev) => ({ ...prev, ...defaults, page: 1 }));
  };

  const updateFilter = <K extends keyof Omit<Filters, 'page'>>(
    key: K,
    value: Omit<Filters, 'page'>[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const presetBtnClass = (active: boolean) =>
    `${PRESET_BTN_BASE} ${
      active
        ? 'border-brand-gold bg-brand-gold/10 text-brand-text'
        : 'border-brand-border text-brand-text-muted hover:border-brand-gold/40 hover:text-brand-text'
    }`;

  const openDetail = (row: AbnormalOperationRow) => {
    setSelected(row);
    setOwnerNoteDraft(row.owner_note ?? '');
  };

  const closeDetail = useCallback(() => {
    setSelected(null);
    setOwnerNoteDraft('');
  }, []);

  const applyPatch = async (patch: {
    status?: AbnormalOperationStatus;
    owner_note?: string | null;
  }) => {
    if (!selected) return;
    const previous = selected;
    setPatching(true);
    const result = await patchAbnormalOperationClient(selected.id, patch);
    setPatching(false);
    if (!result.ok) {
      showToast(t.actionFailed, 'error');
      return;
    }
    closeDetail();
    setData((prev) =>
      prev
        ? mergePatchedAbnormalOperationRow(
            prev,
            previous,
            result.row,
            debouncedFilters.status,
          )
        : prev,
    );
  };

  const stats = data?.stats;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="max-w-6xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-brand-text-muted">{t.subtitle}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading || refreshCooldownSec > 0}
        >
          {refreshCooldownSec > 0
            ? t.refreshCooldown.replace('{n}', String(refreshCooldownSec))
            : t.refresh}
        </Button>
      </header>

      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        <div className="px-4 pt-3 pb-2 border-b border-brand-border/70">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-2.5">
            <h2 className="text-sm font-medium text-brand-text">{t.tableTitle}</h2>
            {stats ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]">
                <span>
                  <span className="text-brand-text-muted">{t.statsTotal}</span>{' '}
                  <span className="font-medium text-brand-text">{stats.total_count}</span>
                </span>
                <span className="text-brand-border/80 hidden sm:inline" aria-hidden>
                  ｜
                </span>
                <span>
                  <span className="text-brand-text-muted">{t.statsHighRisk}</span>{' '}
                  <span className="font-medium text-brand-text">{stats.high_risk_count}</span>
                </span>
                <span className="text-brand-border/80 hidden sm:inline" aria-hidden>
                  ｜
                </span>
                <span>
                  <span className="text-brand-text-muted">{t.statsAmountImpact}</span>{' '}
                  <span className="font-semibold text-brand-gold">
                    €{stats.amount_impact_sum.toFixed(2)}
                  </span>
                </span>
                <span className="text-brand-border/80 hidden sm:inline" aria-hidden>
                  ｜
                </span>
                <span>
                  <span className="text-brand-text-muted">{t.statsPending}</span>{' '}
                  <span className="font-medium text-brand-text">{stats.pending_count}</span>
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => applyDatePreset('today')}
                className={presetBtnClass(activeDatePreset === 'today')}
              >
                {t.presetToday}
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('last7')}
                className={presetBtnClass(activeDatePreset === 'last7')}
              >
                {t.presetLast7}
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('last30')}
                className={presetBtnClass(activeDatePreset === 'last30')}
              >
                {t.presetLast30}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <label className="inline-flex items-center gap-1 text-[13px] text-brand-text-muted">
                <span>{t.filterType}</span>
                <select
                  value={filters.type}
                  onChange={(e) =>
                    updateFilter('type', e.target.value as Filters['type'])
                  }
                  className={COMPACT_SELECT_CLASS}
                  aria-label={t.filterType}
                >
                  <option value="">{t.filterAll}</option>
                  <option value="DISCOUNT_APPLIED">{t.typeDiscount}</option>
                  <option value="ITEM_DELETED">{t.typeItemDeleted}</option>
                  <option value="UNPAID_TABLE_CLOSED">{t.typeUnpaidClose}</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-1 text-[13px] text-brand-text-muted">
                <span>{t.filterRisk}</span>
                <select
                  value={filters.riskLevel}
                  onChange={(e) =>
                    updateFilter('riskLevel', e.target.value as Filters['riskLevel'])
                  }
                  className={COMPACT_SELECT_CLASS}
                  aria-label={t.filterRisk}
                >
                  <option value="">{t.filterAll}</option>
                  <option value="HIGH">{t.riskHigh}</option>
                  <option value="MEDIUM">{t.riskMedium}</option>
                  <option value="LOW">{t.riskLow}</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-1 text-[13px] text-brand-text-muted">
                <span>{t.filterStatus}</span>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    updateFilter('status', e.target.value as Filters['status'])
                  }
                  className={COMPACT_SELECT_CLASS}
                  aria-label={t.filterStatus}
                >
                  <option value="">{t.filterAll}</option>
                  <option value="PENDING">{t.statusPending}</option>
                  <option value="CONFIRMED">{t.statusConfirmed}</option>
                  <option value="IGNORED">{t.statusIgnored}</option>
                </select>
              </label>
              <button
                type="button"
                onClick={resetFilters}
                className="text-[13px] px-2 py-1 rounded-md border border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 whitespace-nowrap"
              >
                {t.filterReset}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="px-4 py-6 text-center text-brand-text-muted text-sm">{t.loading}</p>
        ) : !data?.items.length ? (
          <p className="px-4 py-10 text-center text-brand-text-muted text-sm">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-brand-text-muted text-left text-[13px]">
                  <th className="px-4 py-2 font-medium">{t.colTime}</th>
                  <th className="px-4 py-2 font-medium">{t.colType}</th>
                  <th className="px-4 py-2 font-medium">{t.colTable}</th>
                  <th className="px-4 py-2 font-medium">{t.colRisk}</th>
                  <th className="px-4 py-2 font-medium">{t.colStatus}</th>
                  <th className="px-4 py-2 font-medium">{t.colAmount}</th>
                  <th className="px-4 py-2 font-medium">{t.colReason}</th>
                  <th className="px-4 py-2 font-medium">{t.colOperator}</th>
                  <th className="px-4 py-2 font-medium">{t.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const reasonText = formatAbnormalOperationReasonText(lang, row);
                  const tableOrdersHref = abnormalOperationTableHref(restaurantSlug, row);

                  return (
                  <tr
                    key={row.id}
                    className="border-b border-brand-border/60 hover:bg-brand-border/15"
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-brand-text-muted text-[13px]">
                      {new Date(row.created_at).toLocaleString(locale)}
                    </td>
                    <td className="px-4 py-2 text-[13px]">{typeLabel(t, row.type)}</td>
                    <td className="px-4 py-2 text-[13px]">
                      {tableOrdersHref ? (
                        <Link
                          href={tableOrdersHref}
                          className="text-brand-gold hover:underline whitespace-nowrap"
                        >
                          {row.table_name ?? '—'}
                        </Link>
                      ) : (
                        row.table_name ?? '—'
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${riskBadgeClass(row.risk_level)}`}
                      >
                        {riskLabel(t, row.risk_level)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${statusBadgeClass(row.status)}`}
                      >
                        {statusLabel(t, row.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-brand-gold font-medium text-[13px]">
                      €{Number(row.amount_impact).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 max-w-[10rem]">
                      <ReasonCell text={reasonText} />
                    </td>
                    <td className="px-4 py-2 text-[13px]">
                      {row.operator_name}
                      <span className="text-brand-text-muted text-[12px] ml-1">
                        ({row.operator_role})
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <button
                          type="button"
                          onClick={() => openDetail(row)}
                          className="text-[13px] text-brand-gold hover:underline whitespace-nowrap"
                        >
                          {t.viewDetail}
                        </button>
                        {tableOrdersHref ? (
                          <Link
                            href={tableOrdersHref}
                            className="text-[13px] text-brand-text-muted hover:text-brand-gold hover:underline whitespace-nowrap"
                          >
                            {t.viewTableOrders}
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > data.pageSize ? (
          <div className="px-4 py-3 border-t border-brand-border/70 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-brand-text-muted">
              {t.pageInfo.replace('{page}', String(data.page)).replace('{total}', String(data.total))}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1 || loading}
                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                {t.pagePrev}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= totalPages || loading}
                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                {t.pageNext}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={selected != null}
        onClose={closeDetail}
        title={t.detailTitle}
        size="md"
      >
        {selected ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-brand-text-muted text-[13px]">{t.colType}</p>
                <p className="text-brand-text">{typeLabel(t, selected.type)}</p>
              </div>
            <div>
              <p className="text-brand-text-muted text-[13px]">{t.colTable}</p>
              <p className="text-brand-text">
                {selected.table_id ? (
                  <Link
                    href={abnormalOperationTableHref(restaurantSlug, selected)!}
                    className="text-brand-gold hover:underline"
                  >
                    {selected.table_name ?? '—'}
                  </Link>
                ) : (
                  selected.table_name ?? '—'
                )}
              </p>
            </div>
              <div>
                <p className="text-brand-text-muted text-[13px]">{t.colOperator}</p>
                <p className="text-brand-text">
                  {selected.operator_name} ({selected.operator_role})
                </p>
              </div>
              <div>
                <p className="text-brand-text-muted text-[13px]">{t.colAmount}</p>
                <p className="text-brand-gold">€{Number(selected.amount_impact).toFixed(2)}</p>
              </div>
            </div>
            <div>
              <p className="text-brand-text-muted text-[13px]">{t.reason}</p>
              <p className="text-brand-text">
                {formatAbnormalOperationReasonText(lang, selected)}
              </p>
            </div>
            {selected.table_id ? (
              <div>
                <Link
                  href={abnormalOperationTableHref(restaurantSlug, selected)!}
                  className="text-sm text-brand-gold hover:underline"
                >
                  {t.viewTableOrders}
                </Link>
              </div>
            ) : null}
            <label className="block">
              <span className="text-brand-text-muted text-[13px] block mb-1">{t.ownerNote}</span>
              <textarea
                value={ownerNoteDraft}
                onChange={(e) => setOwnerNoteDraft(e.target.value)}
                placeholder={t.ownerNotePlaceholder}
                rows={3}
                className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-2 justify-end pt-2">
              {selected.status === 'PENDING' ? (
                <>
                  <Button
                    variant="outline"
                    loading={patching}
                    onClick={() => void applyPatch({ status: 'IGNORED' })}
                  >
                    {t.ignore}
                  </Button>
                  <Button loading={patching} onClick={() => void applyPatch({ status: 'CONFIRMED' })}>
                    {t.confirm}
                  </Button>
                </>
              ) : null}
              <Button
                variant="outline"
                loading={patching}
                onClick={() =>
                  void applyPatch({
                    owner_note: ownerNoteDraft.trim() || null,
                  })
                }
              >
                {t.saveNote}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
