import { notFound, redirect } from 'next/navigation';
import { ValueAnalyticsPageClient } from '@/components/dashboard/ValueAnalyticsPageClient';
import { loadDashboardAccess } from '@/lib/dashboard-access';

export default async function ValueAnalyticsPage() {
  const access = await loadDashboardAccess();
  if (access.mode === 'unauthenticated') {
    redirect('/auth/login');
  }
  if (access.mode !== 'owner') {
    notFound();
  }

  return <ValueAnalyticsPageClient />;
}
