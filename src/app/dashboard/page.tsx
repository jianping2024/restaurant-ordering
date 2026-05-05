import { createClient } from '@/lib/supabase/server';
import type { Order } from '@/types';
import { DashboardPageClient } from '@/components/dashboard/DashboardPageClient';

// 数据概览（数据服务端获取，文案与 LanguageProvider 同步）
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', user!.id)
    .single();

  if (!restaurant) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .gte('created_at', todayStart.toISOString());

  const { data: allOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const { count: menuCount } = await supabase
    .from('menu_items')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurant.id);

  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: feedbackSessions } = await supabase
    .from('feedback_sessions')
    .select('session_id, completed_at')
    .eq('restaurant_id', restaurant.id)
    .gte('created_at', sinceIso);

  const { data: billedSplits } = await supabase
    .from('bill_splits')
    .select('session_id')
    .eq('restaurant_id', restaurant.id)
    .gte('created_at', sinceIso)
    .not('session_id', 'is', null);

  const { data: dishFeedbackRows } = await supabase
    .from('dish_feedback')
    .select('menu_item_id, vote, reasons, menu_items(name_pt, name_en, name_zh)')
    .eq('restaurant_id', restaurant.id)
    .gte('created_at', sinceIso);

  const orders = (todayOrders || []) as Order[];
  const todayRevenue = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const doneOrders = orders.filter((o) => o.status === 'done').length;

  const itemCount: Record<string, { name: string; count: number; emoji: string }> = {};
  orders.forEach((order) => {
    order.items.forEach((item) => {
      if (!itemCount[item.name_pt]) {
        itemCount[item.name_pt] = { name: item.name_pt, count: 0, emoji: item.emoji };
      }
      itemCount[item.name_pt].count += item.qty;
    });
  });
  const topItems = Object.values(itemCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const recentOrders = ((allOrders || []) as Order[]).slice(0, 6);

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
  const upRows = (dishFeedbackRows || []).filter((row) => row.vote === 'up');
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

  const praiseMap = new Map<string, { dish_name: string; up_count: number }>();
  upRows.forEach((row) => {
    const nested = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items;
    const dishName = nested?.name_zh || nested?.name_en || nested?.name_pt || row.menu_item_id;
    const current = praiseMap.get(row.menu_item_id) || { dish_name: dishName, up_count: 0 };
    current.up_count += 1;
    praiseMap.set(row.menu_item_id, current);
  });
  const topPraise = Array.from(praiseMap.entries())
    .map(([menu_item_id, value]) => ({ menu_item_id, ...value }))
    .sort((a, b) => b.up_count - a.up_count)
    .slice(0, 5);

  return (
    <DashboardPageClient
      todayOrderCount={orders.length}
      todayRevenue={todayRevenue}
      doneOrderCount={doneOrders}
      menuCount={menuCount || 0}
      topItems={topItems}
      recentOrders={recentOrders}
      touchedRate={touchedRate}
      completedRate={completedRate}
      actionableRate={actionableRate}
      sessionsWithFeedback={sessionsWithFeedback}
      billedSessions={billedSessions}
      topIssues={topIssues}
      topPraise={topPraise}
    />
  );
}
