import { notFound, redirect } from 'next/navigation';
import { ValueAnalyticsPageClient } from '@/components/dashboard/ValueAnalyticsPageClient';
import { getValueOverview } from '@/lib/analytics/analytics.service';
import { getOwnerAnalyticsContext } from '@/lib/analytics/load-owner-analytics-context';
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

  const result = await getValueOverview(ctx.admin, ctx.restaurantId, '7d');

  return (
    <ValueAnalyticsPageClient
      initialOverview={result.ok ? result.data : null}
      initialLoadFailed={!result.ok}
    />
  );
}
