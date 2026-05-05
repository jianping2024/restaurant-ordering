import { createClient } from '@/lib/supabase/server';
import type { BillSplit, Order } from '@/types';
import { OrdersPageClient } from '@/components/dashboard/OrdersPageClient';

// 订单历史页（数据在服务端获取，文案在客户端与 LanguageProvider 同步）
export default async function OrdersPage() {
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

  const { data: closedSessions } = await supabase
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', restaurant!.id)
    .eq('status', 'closed');

  const closedSessionIds = new Set((closedSessions || []).map((row) => row.id));
  const historicalOrders = (orders || []).filter(
    (order) => !!order.session_id && closedSessionIds.has(order.session_id),
  );

  return (
    <OrdersPageClient
      orders={historicalOrders as Order[]}
      checkoutRequests={[] as BillSplit[]}
      headingNavKey="orders"
      showCheckoutRequests={false}
    />
  );
}
