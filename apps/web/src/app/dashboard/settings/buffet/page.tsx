import { redirect } from 'next/navigation';
import { isRestaurantSuspended } from '@mesa/shared';
import { BuffetSettingsManager } from '@/components/dashboard/BuffetSettingsManager';
import { loadBuffetSettingsPageData, requireOwnerRestaurant } from '@/lib/settings-page-data';

export default async function SettingsBuffetPage() {
  const restaurant = await requireOwnerRestaurant();
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
