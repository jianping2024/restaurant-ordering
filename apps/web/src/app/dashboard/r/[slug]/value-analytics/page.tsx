import { ValueAnalyticsPageClient } from '@/components/dashboard/ValueAnalyticsPageClient';
import { getOwnerAnalyticsContext } from '@/lib/analytics/load-owner-analytics-context';
import { getCachedValueOverview } from '@/lib/analytics/value-overview-cache';
import { redirectForLoaderError } from '@/lib/premium/page-gate';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';

export default async function ValueAnalyticsPage({ params }: { params: { slug: string } }) {
  const store = await requireDashboardStore(params.slug);
  const ctx = await getOwnerAnalyticsContext(store.restaurant.id);
  if ('error' in ctx) {
    redirectForLoaderError(ctx, store.restaurant.slug);
  }

  const result = await getCachedValueOverview(ctx.restaurantId, 'day');

  return (
    <ValueAnalyticsPageClient
      initialOverview={result.ok ? result.data : null}
      initialLoadFailed={!result.ok}
    />
  );
}
