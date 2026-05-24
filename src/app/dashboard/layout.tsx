import { redirect } from 'next/navigation';
import { DashboardAccessError } from '@/components/dashboard/DashboardAccessError';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { RestaurantOnboarding } from '@/components/dashboard/RestaurantOnboarding';
import { loadDashboardAccess } from '@/lib/dashboard-access';

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

  return (
    <div className="min-h-screen bg-brand-bg flex">
      <DashboardNav restaurant={access.restaurant} accessMode={access.mode} />
      <main className="flex-1 min-w-0 overflow-x-hidden lg:ml-64 p-4 pt-20 sm:p-6 sm:pt-20 lg:p-8 lg:pt-8 min-h-screen">
        {children}
      </main>
    </div>
  );
}
