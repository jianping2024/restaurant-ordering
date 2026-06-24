import { notFound } from 'next/navigation';
import type { Order } from '@/types';
import { OrdersPageClient } from '@/components/dashboard/OrdersPageClient';
import { loadOwnerDashboardTables } from '@/lib/dashboard-tables';
import { fetchCheckoutRequestedTableIds } from '@/lib/table-checkout-pending';

export default async function UnpaidOrdersPage() {
  const loaded = await loadOwnerDashboardTables();
  if ('error' in loaded) notFound();

  const { data: activeSessions } = await loaded.admin
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', loaded.restaurant.id)
    .in('status', ['open', 'billing']);

  const activeSessionIds = new Set((activeSessions || []).map((row) => row.id));

  const { data: orders } = await loaded.admin
    .from('orders')
    .select('*')
    .eq('restaurant_id', loaded.restaurant.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const openOrders = (orders || []).filter((order) => !!order.session_id && activeSessionIds.has(order.session_id));
  const checkoutRequestedTableIds = await fetchCheckoutRequestedTableIds(
    loaded.admin,
    loaded.restaurant.id,
  );

  return (
    <OrdersPageClient
      orders={openOrders as Order[]}
      restaurantId={loaded.restaurant.id}
      tables={loaded.tables}
      headingNavKey="unpaidOrders"
      showCloseTable
      initialCheckoutRequestedTableIds={checkoutRequestedTableIds}
    />
  );
}
