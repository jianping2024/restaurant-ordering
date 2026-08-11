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
import { isOnPremInstallHost } from '@/lib/license-on-prem-host';
import { isOperationLogsHostEnabled } from '@/lib/operation-logs/access';

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
    // On-prem empty host: sole path is /setup claim — not free-name RestaurantOnboarding.
    if (isOnPremInstallHost()) {
      redirect('/setup');
    }
    return (
      <div className="min-h-screen bg-brand-bg flex">
        <RestaurantOnboarding />
      </div>
    );
  }

  const caps = principalCaps?.capabilities;
  const checkoutQueueEnabled = Boolean(caps && can(caps, 'dashboard.checkout.view'));
  const waiterBoardEnabled = Boolean(caps && can(caps, 'dashboard.waiter_board.view'));
  const isOwner = access.mode === 'owner';
  const roleLabel =
    principalCaps?.principal.kind === 'staff'
      ? principalCaps.principal.roleName
      : undefined;

  const showSuspensionBanner =
    isRestaurantSuspended(access.restaurant.suspended_at);
  const operationLogsHostEnabled = isOperationLogsHostEnabled();

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
          shellMode={isOwner ? 'owner' : 'staff'}
          roleLabel={roleLabel}
          capabilities={toCapabilitiesPayload(
            caps ?? (isOwner ? resolveCapabilitiesForOwner() : new Set()),
          )}
          operationLogsHostEnabled={operationLogsHostEnabled}
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
  );
}
