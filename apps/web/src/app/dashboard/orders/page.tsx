import { notFound } from 'next/navigation';
import { OrdersHistoryManager } from '@/components/dashboard/OrdersHistoryManager';
import {
  defaultOrderHistoryQuery,
  loadOrderHistoryEntries,
} from '@/lib/order-history/load-entries';
import { loadOrderHistoryDashboardContext } from '@/lib/order-history/load-page-context';

export default async function OrdersPage() {
  const loaded = await loadOrderHistoryDashboardContext();
  if ('error' in loaded) notFound();

  const query = defaultOrderHistoryQuery(loaded.restaurant);
  const initial = await loadOrderHistoryEntries(loaded.admin, query);

  return (
    <OrdersHistoryManager
      initialItems={initial.items}
      initialTotal={initial.total}
      initialItemCodeByMenuId={initial.itemCodeByMenuId}
      initialClosedFrom={query.closedFrom!}
      initialClosedTo={query.closedTo!}
      tables={loaded.tables}
      restaurantSlug={loaded.restaurant.slug}
    />
  );
}
