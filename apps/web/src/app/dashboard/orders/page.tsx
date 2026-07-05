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

  const initial = await loadOrderHistoryEntries(
    loaded.admin,
    defaultOrderHistoryQuery(loaded.restaurant),
  );

  return (
    <OrdersHistoryManager
      initialItems={initial.items}
      initialHasMore={initial.hasMore}
      initialCappedTotal={initial.cappedTotal}
      tables={loaded.tables}
      restaurantSlug={loaded.restaurant.slug}
    />
  );
}
