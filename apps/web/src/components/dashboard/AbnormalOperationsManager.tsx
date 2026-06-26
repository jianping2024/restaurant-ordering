'use client';

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
import { abnormalOperationReasonLabel } from '@/lib/abnormal-operations/reason-display';
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

export function AbnormalOperationsManager() {
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
    setPatching(true);
    const result = await patchAbnormalOperationClient(selected.id, patch);
    setPatching(false);
    if (!result.ok) {
      showToast(t.actionFailed, 'error');
      return;
    }
    closeDetail();
    void load();
  };

  const stats = data?.stats;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="max-w-6xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
          <p className="text-sm text-brand-text-muted mt-2">{t.subtitle}</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={loading || refreshCooldownSec > 0}
        >
          {refreshCooldownSec > 0
            ? t.refreshCooldown.replace('{n}', String(refreshCooldownSec))
            : t.refresh}
        </Button>
      </header>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: t.statsTotal, value: String(stats.total_count) },
            { label: t.statsHighRisk, value: String(stats.high_risk_count) },
            {
              label: t.statsAmountImpact,
              value: `€${stats.amount_impact_sum.toFixed(2)}`,
            },
            { label: t.statsPending, value: String(stats.pending_count) },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-brand-border bg-brand-card px-4 py-3"
            >
              <p className="text-[13px] text-brand-text-muted">{card.label}</p>
              <p className="text-xl font-semibold text-brand-text mt-1">{card.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="bg-brand-card border border-brand-border rounded-xl p-4 mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="text-brand-text-muted text-[13px] block mb-1">{t.filterStart}</span>
          <input
            type="date"
            value={filters.startDate}
            max={filters.endDate}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, startDate: e.target.value, page: 1 }))
            }
            className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="text-brand-text-muted text-[13px] block mb-1">{t.filterEnd}</span>
          <input
            type="date"
            value={filters.endDate}
            min={filters.startDate}
            max={today}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, endDate: e.target.value, page: 1 }))
            }
            className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-end gap-2 md:col-span-2">
          <button
            type="button"
            onClick={() =>
              setFilters((prev) => ({ ...prev, startDate: today, endDate: today, page: 1 }))
            }
            className="text-sm px-3 py-2 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text"
          >
            {t.presetToday}
          </button>
          <button
            type="button"
            onClick={() => {
              const start = addCalendarDays(today, -6);
              setFilters((prev) => ({ ...prev, startDate: start, endDate: today, page: 1 }));
            }}
            className="text-sm px-3 py-2 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text"
          >
            {t.presetLast7}
          </button>
        </div>
        <label className="text-sm">
          <span className="text-brand-text-muted text-[13px] block mb-1">{t.filterType}</span>
          <select
            value={filters.type}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                type: e.target.value as Filters['type'],
                page: 1,
              }))
            }
            className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm"
          >
            <option value="">{t.filterAll}</option>
            <option value="DISCOUNT_APPLIED">{t.typeDiscount}</option>
            <option value="ITEM_DELETED">{t.typeItemDeleted}</option>
            <option value="UNPAID_TABLE_CLOSED">{t.typeUnpaidClose}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-brand-text-muted text-[13px] block mb-1">{t.filterRisk}</span>
          <select
            value={filters.riskLevel}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                riskLevel: e.target.value as Filters['riskLevel'],
                page: 1,
              }))
            }
            className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm"
          >
            <option value="">{t.filterAll}</option>
            <option value="HIGH">{t.riskHigh}</option>
            <option value="MEDIUM">{t.riskMedium}</option>
            <option value="LOW">{t.riskLow}</option>
          </select>
        </label>
        <label className="text-sm md:col-span-2">
          <span className="text-brand-text-muted text-[13px] block mb-1">{t.filterStatus}</span>
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                status: e.target.value as Filters['status'],
                page: 1,
              }))
            }
            className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm"
          >
            <option value="">{t.filterAll}</option>
            <option value="PENDING">{t.statusPending}</option>
            <option value="CONFIRMED">{t.statusConfirmed}</option>
            <option value="IGNORED">{t.statusIgnored}</option>
          </select>
        </label>
      </div>

      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-brand-text-muted text-sm">{t.loading}</p>
        ) : !data?.items.length ? (
          <p className="p-12 text-center text-brand-text-muted">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-brand-text-muted text-left">
                  <th className="px-4 py-3 font-medium">{t.colTime}</th>
                  <th className="px-4 py-3 font-medium">{t.colType}</th>
                  <th className="px-4 py-3 font-medium">{t.colTable}</th>
                  <th className="px-4 py-3 font-medium">{t.colOperator}</th>
                  <th className="px-4 py-3 font-medium">{t.colAmount}</th>
                  <th className="px-4 py-3 font-medium">{t.colRisk}</th>
                  <th className="px-4 py-3 font-medium">{t.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-brand-border/60 hover:bg-brand-border/20 cursor-pointer"
                    onClick={() => openDetail(row)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-brand-text-muted">
                      {new Date(row.created_at).toLocaleString(locale)}
                    </td>
                    <td className="px-4 py-3">{typeLabel(t, row.type)}</td>
                    <td className="px-4 py-3">{row.table_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {row.operator_name}
                      <span className="text-brand-text-muted text-[12px] ml-1">
                        ({row.operator_role})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-gold">
                      €{Number(row.amount_impact).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${riskBadgeClass(row.risk_level)}`}
                      >
                        {riskLabel(t, row.risk_level)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${statusBadgeClass(row.status)}`}
                      >
                        {statusLabel(t, row.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.total > data.pageSize ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-brand-text-muted">
            {t.pageInfo.replace('{page}', String(data.page)).replace('{total}', String(data.total))}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={data.page <= 1 || loading}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              {t.pagePrev}
            </Button>
            <Button
              variant="outline"
              disabled={data.page >= totalPages || loading}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              {t.pageNext}
            </Button>
          </div>
        </div>
      ) : null}

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
                <p className="text-brand-text">{selected.table_name ?? '—'}</p>
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
                {abnormalOperationReasonLabel(lang, selected.type, selected.reason)}
              </p>
              {selected.reason_detail ? (
                <p className="text-brand-text-muted mt-1">{selected.reason_detail}</p>
              ) : null}
            </div>
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
