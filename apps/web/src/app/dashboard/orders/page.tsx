import { notFound } from 'next/navigation';
import type { Order } from '@/types';
import { OrdersHistoryManager } from '@/components/dashboard/OrdersHistoryManager';
import { loadFrontdeskDashboardTables } from '@/lib/dashboard-tables';

export default async function OrdersPage() {
  const loaded = await loadFrontdeskDashboardTables();
  if ('error' in loaded) notFound();

  const { data: orders } = await loaded.admin
    .from('orders')
    .select('*')
    .eq('restaurant_id', loaded.restaurant.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: closedSessions } = await loaded.admin
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', loaded.restaurant.id)
    .eq('status', 'closed');

  const closedSessionIds = new Set((closedSessions || []).map((row) => row.id));
  const historicalOrders = (orders || []).filter(
    (order) => !!order.session_id && closedSessionIds.has(order.session_id),
  );

  return (
    <OrdersHistoryManager
      initialOrders={historicalOrders as Order[]}
      tables={loaded.tables}
    />
  );
}
