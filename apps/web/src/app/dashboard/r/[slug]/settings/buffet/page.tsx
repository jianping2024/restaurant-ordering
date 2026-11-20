import { dashboardStoreHref } from '@/lib/dashboard-store-routes';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';
import { redirect } from 'next/navigation';
import { isRestaurantSuspended } from '@mesa/shared';
import { BuffetSettingsManager } from '@/components/dashboard/BuffetSettingsManager';
import { loadBuffetSettingsPageData, requireRestaurantForSettingsPermission } from '@/lib/settings-page-data';
import type { PermissionKey } from '@/lib/permissions/registry';

export default async function SettingsBuffetPage({ params }: { params: { slug: string } }) {
  const store = await requireDashboardStore(params.slug);
  const permission: PermissionKey = 'settings.buffet.manage';
  const restaurant = await requireRestaurantForSettingsPermission(permission, store.restaurant.id, { requireWritable: true });
  if (isRestaurantSuspended(restaurant.suspended_at)) redirect(dashboardStoreHref(params.slug));

  const data = await loadBuffetSettingsPageData(restaurant.id);

  return (
    <BuffetSettingsManager
      embedded
      restaurantId={restaurant.id}
      initialData={data}
    />
  );
}
