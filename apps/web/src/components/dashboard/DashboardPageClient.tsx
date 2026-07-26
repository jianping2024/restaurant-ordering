'use client';

import { useMemo } from 'react';
import type { OrderStatus } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { FeedbackInsightsPanel } from '@/components/dashboard/FeedbackInsightsPanel';
import { DashboardTopSellingPanel } from '@/components/dashboard/DashboardTopSellingPanel';
import { formatBuffetReceiptQtyLabel } from '@/lib/buffet-order';
import { formatOrderDateTime, formatOverviewDate } from '@/lib/format-dashboard-date';
import {
  localizeTopSellingItems,
  pendingActionsTotal,
  type DashboardOverviewPrimaryView,
  type DashboardOverviewSecondaryView,
} from '@/lib/dashboard-overview';
import { pickTrilingualName } from '@/lib/i18n/pick-trilingual-name';

function orderStatusBadgeClass(status: OrderStatus): string {
  if (status === 'done') return 'mesa-badge-success';
  return 'mesa-badge-warning';
}

export function DashboardOverviewPrimaryClient({
  primary,
}: {
  primary: DashboardOverviewPrimaryView;
}) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).dashboard;
  const { todayKpis, pendingActions } = primary;

  const overviewDateLabel = useMemo(() => formatOverviewDate(lang), [lang]);
  const pendingTotal = pendingActionsTotal(pendingActions);

  const pendingRows = [
    { key: 'inProgress', label: i18n.pendingInProgress, count: pendingActions.inProgressOrders },
    { key: 'checkout', label: i18n.pendingCheckout, count: pendingActions.pendingCheckout },
    { key: 'abnormal', label: i18n.pendingAbnormal, count: pendingActions.pendingAbnormal, alert: true },
    { key: 'print', label: i18n.pendingPrint, count: pendingActions.pendingPrint },
  ];

  const { todayOrderCount, todayRevenue, avgTicketPrice, revenueAvailable } = todayKpis;
  const inProgressOrderCount = pendingActions.inProgressOrders;

  const stats = [
    {
      key: 'revenue',
      label: i18n.todayRevenue,
      value: revenueAvailable ? `€${todayRevenue.toFixed(2)}` : i18n.todayRevenueUnavailable,
      unit: '',
      color: revenueAvailable ? 'text-brand-gold' : 'text-brand-text-muted',
      prominent: true,
    },
    {
      key: 'orders',
      label: i18n.todayOrders,
      value: todayOrderCount,
      unit: i18n.unitOrder,
      color: 'text-brand-text',
      prominent: false,
    },
    {
      key: 'inProgress',
      label: i18n.inProgressOrders,
      value: inProgressOrderCount,
      unit: i18n.unitOrder,
      color: inProgressOrderCount > 0 ? 'text-amber-400' : 'text-brand-text',
      prominent: false,
    },
    {
      key: 'avgTicket',
      label: i18n.avgTicket,
      value: revenueAvailable ? `€${avgTicketPrice.toFixed(2)}` : i18n.todayRevenueUnavailable,
      unit: '',
      color: revenueAvailable ? 'text-brand-text' : 'text-brand-text-muted',
      prominent: false,
    },
  ];

  return (
    <>
      <div className="mb-6">
        <p className="text-brand-text-muted text-sm">{overviewDateLabel}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className={`bg-brand-card border border-brand-border rounded-2xl p-6 ${
              stat.prominent ? 'lg:col-span-1 ring-1 ring-brand-gold/25' : ''
            }`}
          >
            <p className="text-brand-text-muted text-[13px] mb-2">{stat.label}</p>
            <p
              className={`font-heading ${stat.prominent ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'} ${stat.color}`}
            >
              {stat.value}
              {stat.unit && (
                <span className="text-base ml-1 text-brand-text-muted">{stat.unit}</span>
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-brand-card border border-brand-border rounded-2xl p-4 mb-6">
        <h2 className="font-heading text-lg text-brand-text mb-3">{i18n.pendingActions}</h2>
        {pendingTotal === 0 ? (
          <p className="text-[13px] text-brand-text-muted">{i18n.pendingActionsEmpty}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pendingRows
              .filter((row) => row.count > 0)
              .map((row) => (
                <span
                  key={row.key}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] ${
                    row.alert
                      ? 'mesa-badge-danger border-red-500/30'
                      : 'border-brand-border text-brand-text'
                  }`}
                >
                  <span className="text-brand-text-muted">{row.label}</span>
                  <span className="font-semibold tabular-nums">{row.count}</span>
                </span>
              ))}
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
  const { topSelling, recentOrders, feedback } = secondary;

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

  const orderStatusLabel = (status: OrderStatus): string => {
    if (status === 'done') return orderI18n.done;
    if (status === 'cooking') return orderI18n.cooking;
    return orderI18n.pending;
  };

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

      <div className="grid lg:grid-cols-2 gap-6">
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

        <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
          <h2 className="font-heading text-xl text-brand-gold mb-4">{i18n.recent}</h2>
          {recentOrders.length === 0 ? (
            <p className="text-brand-text-muted text-sm">{i18n.noOrders}</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => {
                const guests = order.buffetGuests
                  ? formatBuffetReceiptQtyLabel(order.buffetGuests.adults, order.buffetGuests.children)
                  : null;
                return (
                  <div
                    key={order.id}
                    className="flex items-start justify-between gap-3 py-2 border-b border-brand-border last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm text-brand-text">
                          {i18n.table} {order.display_name}
                        </p>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border ${orderStatusBadgeClass(order.status)}`}
                        >
                          {orderStatusLabel(order.status)}
                        </span>
                      </div>
                      <p className="text-[13px] text-brand-text-muted mt-0.5">
                        {formatOrderDateTime(lang, order.created_at)}
                        {guests ? <span className="ml-2">{guests}</span> : null}
                      </p>
                    </div>
                    <p className="text-sm text-brand-gold shrink-0 tabular-nums">
                      €{order.total_amount.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
