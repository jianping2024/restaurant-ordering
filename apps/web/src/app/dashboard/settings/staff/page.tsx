import { StaffAccountsManager } from '@/components/dashboard/StaffAccountsManager';
import { loadStaffSettingsPageData, requireRestaurantForSettingsPermission } from '@/lib/settings-page-data';
import type { PermissionKey } from '@/lib/permissions/registry';

export default async function SettingsStaffPage() {
  const permission: PermissionKey = 'settings.staff.manage';
  const restaurant = await requireRestaurantForSettingsPermission(permission);
  const staff = await loadStaffSettingsPageData(restaurant.id);
  return <StaffAccountsManager embedded initialStaff={staff} />;
}
