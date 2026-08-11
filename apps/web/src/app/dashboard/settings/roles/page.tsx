import { RolesPermissionsManager } from './RolesPermissionsManager';
import { isOperationLogsHostEnabled } from '@/lib/operation-logs/access';
import { requireRestaurantForSettingsPermission } from '@/lib/settings-page-data';
import type { PermissionKey } from '@/lib/permissions/registry';

export default async function SettingsRolesPage() {
  const permission: PermissionKey = 'settings.roles.manage';
  await requireRestaurantForSettingsPermission(permission);
  return (
    <RolesPermissionsManager operationLogsHostEnabled={isOperationLogsHostEnabled()} />
  );
}
