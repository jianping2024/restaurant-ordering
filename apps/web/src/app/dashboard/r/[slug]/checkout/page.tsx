import { redirect } from 'next/navigation';
import { CheckoutRequestsManager } from '@/components/dashboard/CheckoutRequestsManager';
import { parseCheckoutQueueFocus } from '@/lib/checkout-queue-focus';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';
import { dashboardStoreHref } from '@/lib/dashboard-store-routes';
import { can } from '@/lib/permissions/can';
import { toCapabilitiesPayload } from '@/lib/permissions/can';
import { isRestaurantFeatureEnabled } from '@mesa/shared';

export default async function CheckoutRequestsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Promise<{ table_id?: string; request_id?: string }>;
}) {
  const access = await requireDashboardStore(params.slug);
  const { loaded } = access;
  if (!can(loaded.capabilities, 'dashboard.checkout.view')) {
    redirect(dashboardStoreHref(access.restaurant.slug));
  }

  const restaurant = access.restaurant;
  const initialFocus = parseCheckoutQueueFocus(await searchParams) ?? undefined;

  return (
    <CheckoutRequestsManager
      restaurantId={restaurant.id}
      restaurantSlug={restaurant.slug}
      capabilities={toCapabilitiesPayload(loaded.capabilities)}
      billSyncToFiscal={isRestaurantFeatureEnabled(restaurant.feature_flags, 'bill_sync_to_fiscal')}
      initialFocus={initialFocus}
    />
  );
}
