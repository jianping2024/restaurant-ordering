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

  return (
    <DashboardPageClient
      todayOrderCount={orders.length}
      todayRevenue={todayRevenue}
      doneOrderCount={doneOrders}
      menuCount={menuCount || 0}
      topItems={topItems}
      recentOrders={recentOrders}
    />
  );
}
