import { redirect } from 'next/navigation';
import { ValueAnalyticsPageClient } from '@/components/dashboard/ValueAnalyticsPageClient';
import { getOwnerAnalyticsContext } from '@/lib/analytics/load-owner-analytics-context';
import { getCachedValueOverview } from '@/lib/analytics/value-overview-cache';

export default async function ValueAnalyticsPage() {
  const ctx = await getOwnerAnalyticsContext();
  if ('error' in ctx) {
    if (ctx.status === 401) redirect('/auth/login');
    redirect('/dashboard');
  }

  const result = await getCachedValueOverview(ctx.restaurantId, 'day');

  return (
    <ValueAnalyticsPageClient
      initialOverview={result.ok ? result.data : null}
      initialLoadFailed={!result.ok}
    />
  );
}
