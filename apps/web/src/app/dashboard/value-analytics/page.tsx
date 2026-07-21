import { notFound, redirect } from 'next/navigation';
import { ValueAnalyticsPageClient } from '@/components/dashboard/ValueAnalyticsPageClient';
import { getOwnerAnalyticsContext } from '@/lib/analytics/load-owner-analytics-context';
import { getCachedValueOverview } from '@/lib/analytics/value-overview-cache';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';

export default async function ValueAnalyticsPage() {
  const access = await getDashboardAccess();
  if (access.mode === 'unauthenticated') {
    redirect('/auth/login');
  }
  if (access.mode !== 'owner') {
    notFound();
  }

  const ctx = await getOwnerAnalyticsContext();
  if ('error' in ctx) {
    notFound();
  }

  const result = await getCachedValueOverview(ctx.restaurantId, '7d');

  return (
    <ValueAnalyticsPageClient
      initialOverview={result.ok ? result.data : null}
      initialLoadFailed={!result.ok}
    />
  );
}
