'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DatePicker, DATE_PICKER_COMPACT_TRIGGER_CLASS } from '@mesa/ui';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { FeedbackInsightsPanel } from '@/components/dashboard/FeedbackInsightsPanel';
import { DashboardTopSellingPanel } from '@/components/dashboard/DashboardTopSellingPanel';
import { totalGuestsFromCounts, type BuffetGuestHeadcount } from '@/lib/buffet-order';
import { formatOverviewDate } from '@/lib/format-dashboard-date';
import { addCalendarDays } from '@/lib/lisbon-calendar';
import { DASHBOARD_REVENUE_INTERVAL_MAX_DAYS } from '@/lib/analytics/revenue-interval';
import {
  localizeTopSellingItems,
  pendingActionsTotal,
  type DashboardOverviewPrimaryView,
  type DashboardOverviewSecondaryView,
} from '@/lib/dashboard-overview';
import { DASHBOARD_METRIC_TYPE } from '@/lib/dashboard-metric-type';
import { pickTrilingualName } from '@/lib/i18n/pick-trilingual-name';
import { Button } from '@/components/ui/Button';

/** Sole overview entry into the abnormal-ops list (same path as nav / route permission). */
const ABNORMAL_OPERATIONS_HREF = '/dashboard/abnormal-operations';

function formatBuffetGuestDetail(
  template: string,
  guests: BuffetGuestHeadcount,
): string {
  return template
    .replace('{adults}', String(guests.adults))
    .replace('{children}', String(guests.children));
}

function pendingChipClassName(alert: boolean): string {
  return `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] ${
    alert
      ? 'mesa-badge-danger border-red-500/30'
      : 'border-brand-border text-brand-text'
  }`;
}

/** Sole dashboard dual-metric KPI card (today tables|guests and dining tables|guests). */
function DashboardDualMetricCard({
  figureClass,
  left,
  right,
  available = true,
  unavailableLabel,
}: {
  figureClass: string;
  left: { label: string; value: number; unit: string; detail?: string | null };
  right: { label: string; value: number; unit: string; detail?: string | null };
  available?: boolean;
  unavailableLabel?: string;
}) {
  const valueTone = available ? 'text-brand-text' : 'text-brand-text-muted';

  function column(metric: {
    label: string;
    value: number;
    unit: string;
    detail?: string | null;
  }) {
    return (
      <div className="min-w-0 flex-1">
        <p className="text-brand-text-muted text-[13px] mb-2">{metric.label}</p>
        <p className={`${figureClass} text-2xl sm:text-3xl ${valueTone}`}>
          {available ? metric.value : unavailableLabel}
          {available ? (
            <span className="text-base ml-1 text-brand-text-muted">{metric.unit}</span>
          ) : null}
        </p>
        {available && metric.detail ? (
          <p className="mt-1.5 text-[13px] text-brand-text-muted tabular-nums">{metric.detail}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
      <div className="flex flex-row gap-5">
        {column(left)}
        {column(right)}
      </div>
    </div>
  );
}

export function DashboardOverviewPrimaryClient({
  primary,
}: {
  primary: DashboardOverviewPrimaryView;
}) {
  const { lang } = useLanguage();
  const messages = getMessages(lang);
  const i18n = messages.dashboard;
  const { todayKpis, pendingActions, todayDateKey } = primary;
  const pickDate = messages.buffetAdmin.pickDate;

  const overviewDateLabel = useMemo(() => formatOverviewDate(lang), [lang]);
  const pendingTotal = pendingActionsTotal(pendingActions);

  const pendingRows: Array<{
    key: string;
    label: string;
    count: number;
    alert?: boolean;
    href?: string;
  }> = [
    { key: 'checkout', label: i18n.pendingCheckout, count: pendingActions.pendingCheckout },
    ...(pendingActions.pendingAbnormal != null
      ? [
          {
            key: 'abnormal',
            label: i18n.pendingAbnormal,
            count: pendingActions.pendingAbnormal,
            alert: true,
            href: ABNORMAL_OPERATIONS_HREF,
          },
        ]
      : []),
    { key: 'print', label: i18n.pendingPrint, count: pendingActions.pendingPrint },
  ];

  const {
    todayTableCount,
    todayRevenue,
    revenueAvailable,
    todayGuests,
    diningTableCount,
    diningGuests,
  } = todayKpis;
  const diningGuestCount = totalGuestsFromCounts(diningGuests);
  const diningGuestDetail = formatBuffetGuestDetail(messages.bill.buffetGuestCounts, diningGuests);
  const todayGuestCount = totalGuestsFromCounts(todayGuests);
  const todayGuestDetail = formatBuffetGuestDetail(messages.bill.buffetGuestCounts, todayGuests);
  const figureClass = DASHBOARD_METRIC_TYPE.figure;
  const moneyClass = DASHBOARD_METRIC_TYPE.money;

  const [draftStartDate, setDraftStartDate] = useState(todayDateKey);
  const [draftEndDate, setDraftEndDate] = useState(todayDateKey);
  const [appliedStartDate, setAppliedStartDate] = useState(todayDateKey);
  const [appliedEndDate, setAppliedEndDate] = useState(todayDateKey);

  const [intervalRevenue, setIntervalRevenue] = useState(revenueAvailable ? todayRevenue : 0);
  const [intervalAvailable, setIntervalAvailable] = useState(revenueAvailable);
  const [intervalLoading, setIntervalLoading] = useState(false);
  const [intervalError, setIntervalError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const startMin = addCalendarDays(todayDateKey, -(DASHBOARD_REVENUE_INTERVAL_MAX_DAYS - 1));
  const startMax = draftEndDate;
  const endMin = draftStartDate;
  const endMax = todayDateKey;

  useEffect(() => {
    if (draftStartDate > draftEndDate) {
      setDraftStartDate(draftEndDate);
    }
  }, [draftStartDate, draftEndDate]);

  const applyRevenueInterval = useCallback(async () => {
    // No-op when nothing changed.
    if (draftStartDate === appliedStartDate && draftEndDate === appliedEndDate) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setIntervalLoading(true);
    setIntervalError(null);

    try {
      const qs = new URLSearchParams({ startDate: draftStartDate, endDate: draftEndDate });
      const res = await fetch(`/api/dashboard/revenue-interval?${qs}`, { signal: ac.signal });
      if (!res.ok) {
        if (res.status === 400) {
          throw new Error(i18n.revenueIntervalRangeHint);
        }
        throw new Error(i18n.revenueIntervalError);
      }
      const json = (await res.json()) as { startDate: string; endDate: string; revenueTotal: number };
      setIntervalRevenue(json.revenueTotal);
      setIntervalAvailable(true);
      setAppliedStartDate(json.startDate);
      setAppliedEndDate(json.endDate);
    } catch (err) {
      if (ac.signal.aborted) return;
      const message = err instanceof Error ? err.message : i18n.revenueIntervalError;
      setIntervalError(message);
    } finally {
      if (!ac.signal.aborted) setIntervalLoading(false);
    }
  }, [appliedEndDate, appliedStartDate, draftEndDate, draftStartDate, i18n]);

  return (
    <>
      <div className="mb-6">
        <p className="text-brand-text-muted text-sm">{overviewDateLabel}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6 ring-1 ring-brand-gold/25">
          <p className="text-brand-text-muted text-[13px] mb-2">{i18n.todayRevenue}</p>
          <p
            className={`${moneyClass} text-3xl sm:text-4xl ${
              revenueAvailable ? 'text-brand-gold' : 'text-brand-text-muted'
            }`}
          >
            {revenueAvailable ? `€${todayRevenue.toFixed(2)}` : i18n.todayRevenueUnavailable}
          </p>
        </div>

        <DashboardDualMetricCard
          figureClass={figureClass}
          available={revenueAvailable}
          unavailableLabel={i18n.todayRevenueUnavailable}
          left={{
            label: i18n.todayTables,
            value: todayTableCount,
            unit: i18n.unitTable,
          }}
          right={{
            label: i18n.todayGuests,
            value: todayGuestCount,
            unit: i18n.unitGuest,
            detail: todayGuestDetail,
          }}
        />

        <DashboardDualMetricCard
          figureClass={figureClass}
          left={{
            label: i18n.diningTables,
            value: diningTableCount,
            unit: i18n.unitTable,
          }}
          right={{
            label: i18n.diningGuests,
            value: diningGuestCount,
            unit: i18n.unitGuest,
            detail: diningGuestDetail,
          }}
        />
      </div>

      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-brand-text-muted text-[13px] mb-1">{i18n.revenueIntervalRevenue}</p>
            <p className="text-[12px] text-brand-text-muted">
              {appliedStartDate === appliedEndDate ? appliedStartDate : `${appliedStartDate} — ${appliedEndDate}`}
            </p>
          </div>
          {intervalLoading ? (
            <span className="text-[12px] text-brand-text-muted whitespace-nowrap">{i18n.revenueIntervalLoading}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            className="w-[10.5rem]"
            triggerClassName={DATE_PICKER_COMPACT_TRIGGER_CLASS}
            value={draftStartDate}
            onChange={(iso) => setDraftStartDate(iso || todayDateKey)}
            lang={lang}
            min={startMin}
            max={startMax}
            placeholder={pickDate}
          />
          <span className="text-brand-text-muted">—</span>
          <DatePicker
            className="w-[10.5rem]"
            triggerClassName={DATE_PICKER_COMPACT_TRIGGER_CLASS}
            value={draftEndDate}
            onChange={(iso) => setDraftEndDate(iso || todayDateKey)}
            lang={lang}
            min={endMin}
            max={endMax}
            placeholder={pickDate}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void applyRevenueInterval()}
            disabled={
              intervalLoading ||
              (draftStartDate === appliedStartDate && draftEndDate === appliedEndDate)
            }
          >
            {intervalLoading ? i18n.revenueIntervalLoading : i18n.revenueIntervalApply}
          </Button>
        </div>

        <p
          className={`${moneyClass} text-3xl sm:text-4xl mt-4 ${
            intervalAvailable ? 'text-brand-gold' : 'text-brand-text-muted'
          }`}
        >
          {intervalAvailable ? `€${intervalRevenue.toFixed(2)}` : i18n.todayRevenueUnavailable}
        </p>

        {intervalError ? (
          <p className="mt-2 text-[12px] text-brand-text-muted">{intervalError}</p>
        ) : (
          <p className="mt-2 text-[12px] text-brand-text-muted">{i18n.revenueIntervalRangeHint}</p>
        )}
      </div>

      <div className="bg-brand-card border border-brand-border rounded-2xl p-4 mb-6">
        <h2 className="font-heading text-lg text-brand-text mb-3">{i18n.pendingActions}</h2>
        {pendingTotal === 0 ? (
          <p className="text-[13px] text-brand-text-muted">{i18n.pendingActionsEmpty}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pendingRows
              .filter((row) => row.count > 0)
              .map((row) => {
                const className = pendingChipClassName(Boolean(row.alert));
                const body = (
                  <>
                    <span className="text-brand-text-muted">{row.label}</span>
                    <span className="font-semibold tabular-nums">{row.count}</span>
                  </>
                );
                if (row.href) {
                  return (
                    <Link
                      key={row.key}
                      href={row.href}
                      className={`${className} hover:opacity-90`}
                    >
                      {body}
                    </Link>
                  );
                }
                return (
                  <span key={row.key} className={className}>
                    {body}
                  </span>
                );
              })}
          </div>
        )}
      </div>
    </>
  );
}

export function DashboardOverviewSecondaryClient({
  secondary,
}: {
  secondary: DashboardOverviewSecondaryView;
}) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).dashboard;
  const orderI18n = getMessages(lang).orderHistory;
  const { topSelling, feedback } = secondary;

  const topItems = useMemo(() => localizeTopSellingItems(topSelling, lang), [topSelling, lang]);

  const localizedIssues = useMemo(
    () =>
      feedback.topIssues.map((row) => ({
        menu_item_id: row.menu_item_id,
        dish_name: pickTrilingualName(row, lang) || row.namePt,
        down_count: row.down_count,
      })),
    [feedback.topIssues, lang],
  );

  const localizedPraise = useMemo(
    () =>
      feedback.topPraise.map((row) => ({
        menu_item_id: row.menu_item_id,
        dish_name: pickTrilingualName(row, lang) || row.namePt,
        up_count: row.up_count,
      })),
    [feedback.topPraise, lang],
  );

  return (
    <>
      <FeedbackInsightsPanel
        title={orderI18n.feedbackTitle}
        emptyTitle={i18n.feedbackEmptyTitle}
        emptyHint={i18n.feedbackEmptyHint}
        hasSufficientData={feedback.hasSufficientData}
        touchedLabel={orderI18n.feedbackTouched}
        completedLabel={orderI18n.feedbackCompleted}
        actionableLabel={orderI18n.feedbackActionable}
        coverageLabel={orderI18n.feedbackCoverage}
        topIssuesLabel={orderI18n.feedbackTopIssues}
        topPraiseLabel={orderI18n.feedbackTopPraise}
        noIssuesLabel={orderI18n.feedbackNoIssues}
        noPraiseLabel={orderI18n.feedbackNoPraise}
        touchedRate={feedback.touchedRate}
        completedRate={feedback.completedRate}
        actionableRate={feedback.actionableRate}
        sessionsWithFeedback={feedback.sessionsWithFeedback}
        billedSessions={feedback.billedSessions}
        topIssues={localizedIssues}
        topPraise={localizedPraise}
      />

      <DashboardTopSellingPanel
        items={topItems}
        i18n={{
          topSellingTitle: i18n.topSellingTitle,
          topSellingEmpty: i18n.topSellingEmpty,
          topSellingListedSummary: i18n.topSellingListedSummary,
          colRank: i18n.topSellingColRank,
          colDish: i18n.topSellingColDish,
          colQty: i18n.topSellingColQty,
          colShare: i18n.topSellingColShare,
        }}
      />
    </>
  );
}
