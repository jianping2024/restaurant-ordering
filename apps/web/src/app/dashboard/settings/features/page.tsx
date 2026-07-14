import { FeatureFlagsManager } from '@/components/dashboard/FeatureFlagsManager';
import { loadFeatureSettingsPageData, requireOwnerRestaurant } from '@/lib/settings-page-data';

export default async function SettingsFeaturesPage() {
  const restaurant = await requireOwnerRestaurant();
  const data = await loadFeatureSettingsPageData(restaurant.id, restaurant.feature_flags);
  return (
    <FeatureFlagsManager
      embedded
      initialFlags={data.flags}
      initialCredentialTtlDays={data.credentialTtlDays}
      initialStationSlipShowCategoryGroup={data.stationSlipShowCategoryGroup}
      initialOrderCooldownSeconds={data.orderCooldownSeconds}
    />
  );
}
