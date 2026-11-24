import { Suspense } from 'react';
import { isRestaurantSuspended } from '@mesa/shared';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardStoreProvider } from '@/components/dashboard/DashboardStoreProvider';
import { RestaurantSuspensionBanner } from '@/components/dashboard/RestaurantSuspensionBanner';
import { resolveDashboardStore } from '@/lib/dashboard-access-cached';
import { DashboardAccessError } from '@/components/dashboard/DashboardAccessError';
import { PrintAgentCredentialExpiryAlert } from '@/components/dashboard/PrintAgentCredentialExpiryAlert';
import { CheckoutRequestsProvider } from '@/components/dashboard/CheckoutRequestsProvider';
import { WaiterBoardProvider } from '@/components/dashboard/WaiterBoardProvider';
import { getPrintAgentDevicesNeedingRenewal } from '@/lib/print-agent-devices-server';
import { can, toCapabilitiesPayload } from '@/lib/permissions/can';
import { loadStoreSwitchData } from '@/lib/store-switch-server';
import {
  computePremiumLockedNavIds,
  loadRestaurantProEntitledKeys,
} from '@/lib/premium/access';

async function OwnerPrintExpiryBanner({ restaurantId }: { restaurantId: string }) {
  const expiringDevices = await getPrintAgentDevicesNeedingRenewal(restaurantId);
  if (expiringDevices.length === 0) return null;
  return <PrintAgentCredentialExpiryAlert devices={expiringDevices} variant="bar" />;
}

export default async function DashboardStoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const access = await resolveDashboardStore(params.slug);
  if (access.mode === 'access_error') {
    return (
      <div className="min-h-screen bg-brand-bg flex">
        <DashboardAccessError message={access.message} />
      </div>
    );
  }
  const principalCaps = access.loaded;

  const caps = principalCaps.capabilities;
  const checkoutQueueEnabled = can(caps, 'dashboard.checkout.view');
  const waiterBoardEnabled = can(caps, 'dashboard.waiter_board.view');
  const isOwner = access.mode === 'owner';
  const roleLabel =
    principalCaps.principal.kind === 'staff'
      ? principalCaps.principal.roleName
      : undefined;

  const showSuspensionBanner =
    isRestaurantSuspended(access.restaurant.suspended_at);

  const [entitledKeys, storeSwitch] = await Promise.all([
    loadRestaurantProEntitledKeys(access.restaurant.id),
    loadStoreSwitchData(principalCaps.principal),
  ]);
  const premiumLockedNavIds = computePremiumLockedNavIds(access.restaurant, entitledKeys);

  return (
    <DashboardStoreProvider restaurantId={access.restaurant.id} slug={access.restaurant.slug}>
    <CheckoutRequestsProvider
      restaurantId={access.restaurant.id}
      restaurantSlug={access.restaurant.slug}
      enabled={checkoutQueueEnabled}
      initialRequests={[]}
    >
      <WaiterBoardProvider
        restaurant={{ id: access.restaurant.id, slug: access.restaurant.slug }}
        enabled={waiterBoardEnabled}
      >
        <DashboardShell
          restaurant={access.restaurant}
          shellMode={isOwner ? 'owner' : 'staff'}
          roleLabel={roleLabel}
          capabilities={toCapabilitiesPayload(caps)}
          premiumLockedNavIds={premiumLockedNavIds}
          storeSwitch={storeSwitch}
        >
          {showSuspensionBanner ? (
            <RestaurantSuspensionBanner reason={access.restaurant.suspension_reason} />
          ) : null}
          {isOwner ? (
            <Suspense fallback={null}>
              <OwnerPrintExpiryBanner restaurantId={access.restaurant.id} />
            </Suspense>
          ) : null}
          {children}
        </DashboardShell>
      </WaiterBoardProvider>
    </CheckoutRequestsProvider>
    </DashboardStoreProvider>
  );
}
