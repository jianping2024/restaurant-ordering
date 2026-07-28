import { RolesPermissionsManager } from './RolesPermissionsManager';
import { requireOwnerRestaurant } from '@/lib/settings-page-data';

export default async function SettingsRolesPage() {
  await requireOwnerRestaurant();
  return <RolesPermissionsManager />;
}
