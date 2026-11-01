import { RolesPermissionsManager } from './RolesPermissionsManager';
import { requireRestaurantForSettingsPermission } from '@/lib/settings-page-data';
import type { PermissionKey } from '@/lib/permissions/registry';
import { permissionKeysHiddenWithoutPremium } from '@/lib/permissions/permission-premium-visibility';
import { loadRestaurantProEntitledKeys } from '@/lib/premium/access';

export default async function SettingsRolesPage() {
  const permission: PermissionKey = 'settings.roles.manage';
  const restaurant = await requireRestaurantForSettingsPermission(permission);
  const entitledKeys = await loadRestaurantProEntitledKeys(restaurant.id);
  const hiddenPermissionKeys = permissionKeysHiddenWithoutPremium(restaurant, entitledKeys);
  return <RolesPermissionsManager hiddenPermissionKeys={hiddenPermissionKeys} />;
}
