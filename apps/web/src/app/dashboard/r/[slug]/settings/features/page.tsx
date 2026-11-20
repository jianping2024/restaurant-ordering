import { requireDashboardStore } from '@/lib/dashboard-access-cached';
import { FeatureFlagsManager } from '@/components/dashboard/FeatureFlagsManager';
import { loadFeatureSettingsPageData, requireRestaurantForSettingsPermission } from '@/lib/settings-page-data';
import type { PermissionKey } from '@/lib/permissions/registry';
import { computePremiumLockedFeatureKeys, loadRestaurantProEntitledKeys } from '@/lib/premium/access';
import { normalizeBuffetServiceMode } from '@mesa/shared';

export default async function SettingsFeaturesPage({ params }: { params: { slug: string } }) {
  const store = await requireDashboardStore(params.slug);
  const permission: PermissionKey = 'settings.features.manage';
  const restaurant = await requireRestaurantForSettingsPermission(permission, store.restaurant.id);
  const [data, entitledKeys] = await Promise.all([
    loadFeatureSettingsPageData(restaurant.id, restaurant.feature_flags),
    loadRestaurantProEntitledKeys(restaurant.id),
  ]);
  return (
    <FeatureFlagsManager
      embedded
      initialFlags={data.flags}
      proLockedFeatureKeys={computePremiumLockedFeatureKeys(restaurant, entitledKeys)}
      buffetServiceMode={normalizeBuffetServiceMode(restaurant.buffet_service_mode)}
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
