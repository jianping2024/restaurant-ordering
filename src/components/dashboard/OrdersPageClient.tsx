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

export interface FeedbackTopPraise {
  menu_item_id: string;
  dish_name: string;
  up_count: number;
}

interface Props {
  orders: Order[];
  checkoutRequests: BillSplit[];
  touchedRate?: number;
  completedRate?: number;
  actionableRate?: number;
  sessionsWithFeedback?: number;
  billedSessions?: number;
  topIssues?: FeedbackTopIssue[];
  topPraise?: FeedbackTopPraise[];
  headingTitle?: string;
  headingNavKey?: 'orders' | 'unpaidOrders' | 'checkout';
  showCheckoutRequests?: boolean;
  showFeedbackPanel?: boolean;
}

export function OrdersPageClient({
  orders,
  checkoutRequests,
  touchedRate = 0,
  completedRate = 0,
  actionableRate = 0,
  sessionsWithFeedback = 0,
  billedSessions = 0,
  topIssues = [],
  topPraise = [],
  headingTitle,
  headingNavKey,
  showCheckoutRequests = true,
  showFeedbackPanel = true,
}: Props) {
  const { lang } = useLanguage();
  const nav = getMessages(lang).nav;
  const i18n = getMessages(lang).orderHistory;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-brand-text">{headingTitle || (headingNavKey ? nav[headingNavKey] : i18n.title)}</h1>
        <p className="text-brand-text-muted text-sm mt-1">
          {i18n.total} {orders.length} {i18n.records}
        </p>
      </div>

      {showCheckoutRequests && <CheckoutRequestsManager initialRequests={checkoutRequests} />}

      {showFeedbackPanel && (
        <FeedbackInsightsPanel
          title={i18n.feedbackTitle}
          touchedLabel={i18n.feedbackTouched}
          completedLabel={i18n.feedbackCompleted}
          actionableLabel={i18n.feedbackActionable}
          coverageLabel={i18n.feedbackCoverage}
          topIssuesLabel={i18n.feedbackTopIssues}
          topPraiseLabel={i18n.feedbackTopPraise}
          noIssuesLabel={i18n.feedbackNoIssues}
          noPraiseLabel={i18n.feedbackNoPraise}
          touchedRate={touchedRate}
          completedRate={completedRate}
          actionableRate={actionableRate}
          sessionsWithFeedback={sessionsWithFeedback}
          billedSessions={billedSessions}
          topIssues={topIssues}
          topPraise={topPraise}
        />
      )}

      <OrdersHistoryManager initialOrders={orders} />
    </div>
  );
}
