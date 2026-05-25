import { createClient } from '@/lib/supabase/server';
import type { BillSplit, Order } from '@/types';
import { OrdersPageClient } from '@/components/dashboard/OrdersPageClient';
import { normalizeRestaurantTableNumbers } from '@/lib/restaurant-table-numbers';

export default async function UnpaidOrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, table_numbers')
    .eq('owner_id', user!.id)
    .single();

  const { data: activeSessions } = await supabase
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', restaurant!.id)
    .in('status', ['open', 'billing']);

  const activeSessionIds = new Set((activeSessions || []).map((row) => row.id));

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurant!.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const openOrders = (orders || []).filter((order) => !!order.session_id && activeSessionIds.has(order.session_id));

  return (
    <OrdersPageClient
      orders={openOrders as Order[]}
      checkoutRequests={[] as BillSplit[]}
      tableNumbers={normalizeRestaurantTableNumbers(restaurant!.table_numbers)}
      headingNavKey="unpaidOrders"
      showCheckoutRequests={false}
    />
  );
}
