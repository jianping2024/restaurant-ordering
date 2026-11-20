import { notFound } from 'next/navigation';
import { OrdersHistoryManager } from '@/components/dashboard/OrdersHistoryManager';
import {
  defaultOrderHistoryQuery,
  loadOrderHistoryEntries,
} from '@/lib/order-history/load-entries';
import { loadOrderHistoryDashboardContext } from '@/lib/order-history/load-page-context';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';
import { can, toCapabilitiesPayload } from '@/lib/permissions/can';
import { isRestaurantFeatureEnabled } from '@mesa/shared';

export default async function OrdersPage({ params }: { params: { slug: string } }) {
  const access = await requireDashboardStore(params.slug);
  const principal = access.loaded;
  if (!can(principal.capabilities, 'dashboard.orders.view')) {
    notFound();
  }

  const loaded = await loadOrderHistoryDashboardContext(access.restaurant.id);
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
      billSyncToFiscal={isRestaurantFeatureEnabled(
        access.restaurant.feature_flags,
        'bill_sync_to_fiscal',
      )}
      capabilities={toCapabilitiesPayload(principal.capabilities)}
    />
  );
}
