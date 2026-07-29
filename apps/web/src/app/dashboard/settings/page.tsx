import { SettingsForm } from '@/components/dashboard/SettingsForm';
import { requireRestaurantForSettingsPermission, toSettingsProfile } from '@/lib/settings-page-data';
import type { PermissionKey } from '@/lib/permissions/registry';

export default async function SettingsPage() {
  const permission: PermissionKey = 'settings.profile.manage';
  const restaurant = await requireRestaurantForSettingsPermission(permission);
  return <SettingsForm embedded restaurant={toSettingsProfile(restaurant)} />;
}
