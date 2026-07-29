import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { isRestaurantSuspended } from '@mesa/shared';
import { DashboardAccessError } from '@/components/dashboard/DashboardAccessError';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { RestaurantOnboarding } from '@/components/dashboard/RestaurantOnboarding';
import { RestaurantSuspensionBanner } from '@/components/dashboard/RestaurantSuspensionBanner';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import { PrintAgentCredentialExpiryAlert } from '@/components/dashboard/PrintAgentCredentialExpiryAlert';
import { CheckoutRequestsProvider } from '@/components/dashboard/CheckoutRequestsProvider';
import { WaiterBoardProvider } from '@/components/dashboard/WaiterBoardProvider';
import { getPrintAgentDevicesNeedingRenewal } from '@/lib/print-agent-devices-server';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import { can, toCapabilitiesPayload } from '@/lib/permissions/can';
import { resolveCapabilitiesForOwner } from '@/lib/permissions/resolve';

/**
 * Print-expiry banner loads in its own Suspense island so it never blocks page children.
 * Checkout queue is not SSR-awaited here: Provider mount reconcile + Realtime fill the badge
 * (layout previously awaited the queue and then remount-reconciled again).
 */
async function OwnerPrintExpiryBanner({ restaurantId }: { restaurantId: string }) {
  const expiringDevices = await getPrintAgentDevicesNeedingRenewal(restaurantId);
  if (expiringDevices.length === 0) return null;
  return <PrintAgentCredentialExpiryAlert devices={expiringDevices} variant="bar" />;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getDashboardAccess();
  const principalCaps = await loadPrincipalWithCapabilities();

  if (access.mode === 'unauthenticated') {
    redirect('/auth/login');
  }

  if (access.mode === 'access_error') {
    return (
      <div className="min-h-screen bg-brand-bg flex">
        <DashboardAccessError message={access.message} />
      </div>
    );
  }

  if (access.mode === 'onboarding') {
    return (
      <div className="min-h-screen bg-brand-bg flex">
        <RestaurantOnboarding />
      </div>
    );
  }

  const caps = principalCaps?.capabilities;
  /** Checkout queue when capability grants checkout view (not role enum). */
  const checkoutQueueEnabled = Boolean(caps && can(caps, 'dashboard.checkout.view'));

  /** Board loads on floor list surface — capability only (no role-list fallback). */
  const waiterBoardEnabled = Boolean(caps && can(caps, 'dashboard.waiter_board.view'));

  const showSuspensionBanner =
    (access.mode === 'owner' ||
      access.mode === 'frontdesk' ||
      access.mode === 'store_owner') &&
    isRestaurantSuspended(access.restaurant.suspended_at);

  return (
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
          accessMode={access.mode}
          capabilities={toCapabilitiesPayload(
            caps ?? (access.mode === 'owner' ? resolveCapabilitiesForOwner() : new Set()),
          )}
        >
          {showSuspensionBanner ? (
            <RestaurantSuspensionBanner reason={access.restaurant.suspension_reason} />
          ) : null}
          {access.mode === 'owner' ? (
            <Suspense fallback={null}>
              <OwnerPrintExpiryBanner restaurantId={access.restaurant.id} />
            </Suspense>
          ) : null}
          {children}
        </DashboardShell>
      </WaiterBoardProvider>
    </CheckoutRequestsProvider>
  );
}
