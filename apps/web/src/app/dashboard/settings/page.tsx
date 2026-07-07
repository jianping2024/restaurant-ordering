import { SettingsForm } from '@/components/dashboard/SettingsForm';
import { requireOwnerRestaurant, toSettingsProfile } from '@/lib/settings-page-data';

export default async function SettingsPage() {
  const restaurant = await requireOwnerRestaurant();
  return <SettingsForm embedded restaurant={toSettingsProfile(restaurant)} />;
}
