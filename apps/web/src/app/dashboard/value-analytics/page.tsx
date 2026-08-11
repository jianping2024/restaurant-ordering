import { ValueAnalyticsPageClient } from '@/components/dashboard/ValueAnalyticsPageClient';
import { getOwnerAnalyticsContext } from '@/lib/analytics/load-owner-analytics-context';
import { getCachedValueOverview } from '@/lib/analytics/value-overview-cache';
import { redirectForLoaderError } from '@/lib/premium/page-gate';

export default async function ValueAnalyticsPage() {
  const ctx = await getOwnerAnalyticsContext();
  if ('error' in ctx) {
    redirectForLoaderError(ctx);
  }

  const result = await getCachedValueOverview(ctx.restaurantId, 'day');

  return (
    <ValueAnalyticsPageClient
      initialOverview={result.ok ? result.data : null}
      initialLoadFailed={!result.ok}
    />
  );
}
