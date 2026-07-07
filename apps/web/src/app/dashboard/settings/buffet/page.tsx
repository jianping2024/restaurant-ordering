import { redirect } from 'next/navigation';
import { BuffetSettingsManager } from '@/components/dashboard/BuffetSettingsManager';
import { loadBuffetDashboard } from '@/lib/dashboard-buffet-server';
import { loadOwnerRestaurantWithSlug } from '@/lib/staff-dashboard-api';

export default async function SettingsBuffetPage() {
  const loaded = await loadOwnerRestaurantWithSlug({ requireWritable: true });
  if ('error' in loaded) {
    if (loaded.error === 'unauthorized') redirect('/auth/login');
    redirect('/dashboard');
  }

  const data = await loadBuffetDashboard(loaded.admin, loaded.restaurant.id);
  if ('error' in data) redirect('/dashboard');

  return (
    <BuffetSettingsManager
      embedded
      restaurantId={loaded.restaurant.id}
      initialData={data}
    />
  );
}
