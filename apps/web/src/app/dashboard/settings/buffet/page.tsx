import { redirect } from 'next/navigation';
import { isRestaurantSuspended } from '@mesa/shared';
import { BuffetSettingsManager } from '@/components/dashboard/BuffetSettingsManager';
import { loadBuffetSettingsPageData, requireRestaurantForSettingsPermission } from '@/lib/settings-page-data';
import type { PermissionKey } from '@/lib/permissions/registry';

export default async function SettingsBuffetPage() {
  const permission: PermissionKey = 'settings.buffet.manage';
  const restaurant = await requireRestaurantForSettingsPermission(permission, { requireWritable: true });
  if (isRestaurantSuspended(restaurant.suspended_at)) redirect('/dashboard');

  const data = await loadBuffetSettingsPageData(restaurant.id);

  return (
    <BuffetSettingsManager
      embedded
      restaurantId={restaurant.id}
      initialData={data}
    />
  );
}
