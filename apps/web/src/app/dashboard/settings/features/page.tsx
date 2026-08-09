import { FeatureFlagsManager } from '@/components/dashboard/FeatureFlagsManager';
import { loadFeatureSettingsPageData, requireRestaurantForSettingsPermission } from '@/lib/settings-page-data';
import type { PermissionKey } from '@/lib/permissions/registry';

export default async function SettingsFeaturesPage() {
  const permission: PermissionKey = 'settings.features.manage';
  const restaurant = await requireRestaurantForSettingsPermission(permission);
  const data = await loadFeatureSettingsPageData(restaurant.id, restaurant.feature_flags, restaurant.print_locale);
  return (
    <FeatureFlagsManager
      embedded
      initialFlags={data.flags}
      initialCredentialTtlDays={data.credentialTtlDays}
      initialStationSlipShowCategoryGroup={data.stationSlipShowCategoryGroup}
      initialOrderCooldownSeconds={data.orderCooldownSeconds}
      initialPrintLocale={data.printLocale}
    />
  );
}
