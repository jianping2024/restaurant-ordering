import { StaffAccountsManager } from '@/components/dashboard/StaffAccountsManager';
import { loadStaffSettingsPageData, requireOwnerRestaurant } from '@/lib/settings-page-data';

export default async function SettingsStaffPage() {
  const restaurant = await requireOwnerRestaurant();
  const staff = await loadStaffSettingsPageData(restaurant.id);
  return <StaffAccountsManager embedded initialStaff={staff} />;
}
