'use client';

import type { BillSplit, Order } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { CheckoutRequestsManager } from '@/components/dashboard/CheckoutRequestsManager';
import { OrdersHistoryManager } from '@/components/dashboard/OrdersHistoryManager';
import { FeedbackInsightsPanel } from '@/components/dashboard/FeedbackInsightsPanel';

export interface FeedbackTopIssue {
  menu_item_id: string;
  dish_name: string;
  down_count: number;
}

interface Props {
  orders: Order[];
  checkoutRequests: BillSplit[];
  touchedRate: number;
  completedRate: number;
  actionableRate: number;
  sessionsWithFeedback: number;
  billedSessions: number;
  topIssues: FeedbackTopIssue[];
}

export function OrdersPageClient({
  orders,
  checkoutRequests,
  touchedRate,
  completedRate,
  actionableRate,
  sessionsWithFeedback,
  billedSessions,
  topIssues,
}: Props) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).orderHistory;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-brand-text">{i18n.title}</h1>
        <p className="text-brand-text-muted text-sm mt-1">
          {i18n.total} {orders.length} {i18n.records}
        </p>
      </div>

      <CheckoutRequestsManager initialRequests={checkoutRequests} />

      <FeedbackInsightsPanel
        title={i18n.feedbackTitle}
        touchedLabel={i18n.feedbackTouched}
        completedLabel={i18n.feedbackCompleted}
        actionableLabel={i18n.feedbackActionable}
        coverageLabel={i18n.feedbackCoverage}
        topIssuesLabel={i18n.feedbackTopIssues}
        noIssuesLabel={i18n.feedbackNoIssues}
        touchedRate={touchedRate}
        completedRate={completedRate}
        actionableRate={actionableRate}
        sessionsWithFeedback={sessionsWithFeedback}
        billedSessions={billedSessions}
        topIssues={topIssues}
      />

      <OrdersHistoryManager initialOrders={orders} />
    </div>
  );
}
