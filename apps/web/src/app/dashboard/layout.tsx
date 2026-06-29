import { redirect } from 'next/navigation';
import { isRestaurantSuspended } from '@mesa/shared';
import { DashboardAccessError } from '@/components/dashboard/DashboardAccessError';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { DASHBOARD_MAIN_OFFSET } from '@/components/dashboard/dashboard-nav-link';
import { RestaurantOnboarding } from '@/components/dashboard/RestaurantOnboarding';
import { RestaurantSuspensionBanner } from '@/components/dashboard/RestaurantSuspensionBanner';
import { loadDashboardAccess } from '@/lib/dashboard-access';
import { PrintAgentCredentialExpiryAlert } from '@/components/dashboard/PrintAgentCredentialExpiryAlert';
import { loadPrintAgentDevicesNeedingRenewal } from '@/lib/print-agent-devices-server';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await loadDashboardAccess();

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

  const expiringDevices =
    access.mode === 'owner'
      ? await loadPrintAgentDevicesNeedingRenewal(access.restaurant.id)
      : [];
  const showSuspensionBanner =
    (access.mode === 'owner' || access.mode === 'frontdesk') &&
    isRestaurantSuspended(access.restaurant.suspended_at);

  return (
    <div className="min-h-screen bg-brand-bg flex">
      <DashboardNav restaurant={access.restaurant} accessMode={access.mode} />
      <main className={`flex-1 min-w-0 overflow-x-hidden ${DASHBOARD_MAIN_OFFSET} p-4 pt-20 sm:p-6 sm:pt-20 lg:p-8 lg:pt-8 min-h-screen`}>
        {showSuspensionBanner ? (
          <RestaurantSuspensionBanner reason={access.restaurant.suspension_reason} />
        ) : null}
        {expiringDevices.length > 0 ? (
          <PrintAgentCredentialExpiryAlert devices={expiringDevices} variant="bar" />
        ) : null}
        {children}
      </main>
    </div>
  );
}
