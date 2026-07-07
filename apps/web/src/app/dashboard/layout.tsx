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
import { fetchCheckoutRequestsQueue } from '@/lib/checkout-requests-queue';
import { loadWaiterBoardInitial } from '@/lib/staff-board';
import { createClient } from '@/lib/supabase/server';
import type { BillSplit } from '@/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getDashboardAccess();

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

  const checkoutQueueEnabled = access.mode !== 'owner';
  let initialCheckoutRequests: BillSplit[] = [];
  if (checkoutQueueEnabled) {
    try {
      const supabase = await createClient();
      initialCheckoutRequests = await fetchCheckoutRequestsQueue(
        supabase,
        access.restaurant.id,
      );
    } catch {
      initialCheckoutRequests = [];
    }
  }

  const waiterBoardEnabled = access.mode === 'frontdesk';
  let initialWaiterBoard = null;
  if (waiterBoardEnabled) {
    try {
      initialWaiterBoard = await loadWaiterBoardInitial(access.restaurant.id);
    } catch {
      initialWaiterBoard = null;
    }
  }

  const expiringDevices =
    access.mode === 'owner'
      ? await getPrintAgentDevicesNeedingRenewal(access.restaurant.id)
      : [];
  const showSuspensionBanner =
    (access.mode === 'owner' || access.mode === 'frontdesk') &&
    isRestaurantSuspended(access.restaurant.suspended_at);

  return (
    <CheckoutRequestsProvider
      restaurantId={access.restaurant.id}
      restaurantSlug={access.restaurant.slug}
      enabled={checkoutQueueEnabled}
      initialRequests={initialCheckoutRequests}
    >
      <WaiterBoardProvider
        restaurant={{ id: access.restaurant.id, slug: access.restaurant.slug }}
        enabled={waiterBoardEnabled}
        initialBoard={initialWaiterBoard}
      >
        <DashboardShell restaurant={access.restaurant} accessMode={access.mode}>
          {showSuspensionBanner ? (
            <RestaurantSuspensionBanner reason={access.restaurant.suspension_reason} />
          ) : null}
          {expiringDevices.length > 0 ? (
            <PrintAgentCredentialExpiryAlert devices={expiringDevices} variant="bar" />
          ) : null}
          {children}
        </DashboardShell>
      </WaiterBoardProvider>
    </CheckoutRequestsProvider>
  );
}
