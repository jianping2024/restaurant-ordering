import { requireDashboardStore } from '@/lib/dashboard-access-cached';
import { StaffAccountsManager } from '@/components/dashboard/StaffAccountsManager';
import { loadStaffSettingsPageData, requireRestaurantForSettingsPermission } from '@/lib/settings-page-data';
import type { PermissionKey } from '@/lib/permissions/registry';

export default async function SettingsStaffPage({ params }: { params: { slug: string } }) {
  const store = await requireDashboardStore(params.slug);
  const permission: PermissionKey = 'settings.staff.manage';
  const restaurant = await requireRestaurantForSettingsPermission(permission, store.restaurant.id);
  const staff = await loadStaffSettingsPageData(restaurant.id);
  return <StaffAccountsManager embedded initialStaff={staff} />;
}
