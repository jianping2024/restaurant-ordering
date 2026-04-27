import { createClient } from '@/lib/supabase/server';
import type { BillSplit, Order } from '@/types';
import { getServerLanguage } from '@/lib/i18n.server';
import { getMessages } from '@/lib/i18n/messages';
import { CheckoutRequestsManager } from '@/components/dashboard/CheckoutRequestsManager';
import { OrdersHistoryManager } from '@/components/dashboard/OrdersHistoryManager';
import { FeedbackInsightsPanel } from '@/components/dashboard/FeedbackInsightsPanel';

// 订单历史页
export default async function OrdersPage() {
  const lang = await getServerLanguage();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user!.id)
    .single();

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurant!.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: checkoutRequests } = await supabase
    .from('bill_splits')
    .select('*')
    .eq('restaurant_id', restaurant!.id)
    .eq('status', 'requested')
    .not('session_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  const i18n = getMessages(lang).orderHistory;
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: feedbackSessions } = await supabase
    .from('feedback_sessions')
    .select('session_id, completed_at')
    .eq('restaurant_id', restaurant!.id)
    .gte('created_at', sinceIso);

  const { data: billedSplits } = await supabase
    .from('bill_splits')
    .select('session_id')
    .eq('restaurant_id', restaurant!.id)
    .gte('created_at', sinceIso)
    .not('session_id', 'is', null);

  const { data: dishFeedbackRows } = await supabase
    .from('dish_feedback')
    .select('menu_item_id, vote, reasons, menu_items(name_pt, name_en, name_zh)')
    .eq('restaurant_id', restaurant!.id)
    .gte('created_at', sinceIso);

  const billedSessionIds = new Set((billedSplits || []).map((row) => row.session_id).filter(Boolean));
  const touchedSessionIds = new Set((feedbackSessions || []).map((row) => row.session_id).filter(Boolean));
  const completedSessionIds = new Set(
    (feedbackSessions || [])
      .filter((row) => !!row.completed_at)
      .map((row) => row.session_id)
      .filter(Boolean)
  );

  const billedSessions = billedSessionIds.size;
  const sessionsWithFeedback = touchedSessionIds.size;
  const touchedRate = billedSessions > 0 ? sessionsWithFeedback / billedSessions : 0;
  const completedRate = sessionsWithFeedback > 0 ? completedSessionIds.size / sessionsWithFeedback : 0;

  const downRows = (dishFeedbackRows || []).filter((row) => row.vote === 'down');
  const actionableDownRows = downRows.filter((row) => Array.isArray(row.reasons) && row.reasons.length > 0);
  const actionableRate = downRows.length > 0 ? actionableDownRows.length / downRows.length : 0;

  const issueMap = new Map<string, { dish_name: string; down_count: number }>();
  downRows.forEach((row) => {
    const nested = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items;
    const dishName = nested?.name_zh || nested?.name_en || nested?.name_pt || row.menu_item_id;
    const current = issueMap.get(row.menu_item_id) || { dish_name: dishName, down_count: 0 };
    current.down_count += 1;
    issueMap.set(row.menu_item_id, current);
  });
  const topIssues = Array.from(issueMap.entries())
    .map(([menu_item_id, value]) => ({ menu_item_id, ...value }))
    .sort((a, b) => b.down_count - a.down_count)
    .slice(0, 5);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-brand-text">{i18n.title}</h1>
        <p className="text-brand-text-muted text-sm mt-1">{i18n.total} {orders?.length || 0} {i18n.records}</p>
      </div>

      <CheckoutRequestsManager initialRequests={(checkoutRequests || []) as BillSplit[]} />

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

      <OrdersHistoryManager initialOrders={(orders || []) as Order[]} />
    </div>
  );
}
