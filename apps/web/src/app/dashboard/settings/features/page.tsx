import { FeatureFlagsManager } from '@/components/dashboard/FeatureFlagsManager';
import { loadFeatureSettingsPageData, requireRestaurantForSettingsPermission } from '@/lib/settings-page-data';
import type { PermissionKey } from '@/lib/permissions/registry';
import { computePremiumLockedFeatureKeys, loadPlatformProSettings } from '@/lib/premium/access';

export default async function SettingsFeaturesPage() {
  const permission: PermissionKey = 'settings.features.manage';
  const restaurant = await requireRestaurantForSettingsPermission(permission);
  const [data, proSettings] = await Promise.all([
    loadFeatureSettingsPageData(restaurant.id, restaurant.feature_flags),
    loadPlatformProSettings(),
  ]);
  return (
    <FeatureFlagsManager
      embedded
      initialFlags={data.flags}
      proLockedFeatureKeys={computePremiumLockedFeatureKeys(restaurant, proSettings)}
      initialOrderCooldownSeconds={data.orderCooldownSeconds}
      initialOperationLogRetentionDays={data.operationLogRetentionDays}
      initialKitchenReadyAfterMinutes={data.kitchenReadyAfterMinutes}
      initialTakeawayVatRate={data.takeawayVatRate}
      initialSushiRoundOrderingEnabled={data.sushiRoundOrderingEnabled}
      initialSushiPerPersonPerRoundCap={data.sushiPerPersonPerRoundCap}
      initialSushiRoundConfirmTimeoutSeconds={data.sushiRoundConfirmTimeoutSeconds}
      initialSushiRoundCooldownSeconds={data.sushiRoundCooldownSeconds}
      initialSushiMenuVegetarianFilterEnabled={data.sushiMenuVegetarianFilterEnabled}
      initialSushiMenuAllergenFilterEnabled={data.sushiMenuAllergenFilterEnabled}
    />
  );
}
