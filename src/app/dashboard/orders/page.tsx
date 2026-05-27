import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { BillSplit, Order } from '@/types';
import { OrdersPageClient } from '@/components/dashboard/OrdersPageClient';
import { loadOwnerDashboardTables } from '@/lib/dashboard-tables';

export default async function OrdersPage() {
  const loaded = await loadOwnerDashboardTables();
  if ('error' in loaded) notFound();

  const supabase = await createClient();

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', loaded.restaurant.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: closedSessions } = await supabase
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', loaded.restaurant.id)
    .eq('status', 'closed');

  const closedSessionIds = new Set((closedSessions || []).map((row) => row.id));
  const historicalOrders = (orders || []).filter(
    (order) => !!order.session_id && closedSessionIds.has(order.session_id),
  );

  return (
    <OrdersPageClient
      orders={historicalOrders as Order[]}
      checkoutRequests={[] as BillSplit[]}
      tables={loaded.tables}
      headingNavKey="orders"
      showCheckoutRequests={false}
    />
  );
}
