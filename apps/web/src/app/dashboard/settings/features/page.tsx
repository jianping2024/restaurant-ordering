import { FeatureFlagsManager } from '@/components/dashboard/FeatureFlagsManager';
import { loadFeatureSettingsPageData, requireRestaurantForSettingsPermission } from '@/lib/settings-page-data';
import type { PermissionKey } from '@/lib/permissions/registry';

export default async function SettingsFeaturesPage() {
  const permission: PermissionKey = 'settings.features.manage';
  const restaurant = await requireRestaurantForSettingsPermission(permission);
  const data = await loadFeatureSettingsPageData(restaurant.id, restaurant.feature_flags);
  return (
    <FeatureFlagsManager
      embedded
      initialFlags={data.flags}
      initialOrderCooldownSeconds={data.orderCooldownSeconds}
      initialOperationLogRetentionDays={data.operationLogRetentionDays}
      initialKitchenReadyAfterMinutes={data.kitchenReadyAfterMinutes}
      initialSushiRoundOrderingEnabled={data.sushiRoundOrderingEnabled}
      initialSushiPerPersonPerRoundCap={data.sushiPerPersonPerRoundCap}
      initialSushiRoundConfirmTimeoutSeconds={data.sushiRoundConfirmTimeoutSeconds}
      initialSushiRoundCooldownSeconds={data.sushiRoundCooldownSeconds}
      initialSushiMenuVegetarianFilterEnabled={data.sushiMenuVegetarianFilterEnabled}
      initialSushiMenuAllergenFilterEnabled={data.sushiMenuAllergenFilterEnabled}
    />
  );
}
