import { OperationLogsManager } from '@/components/dashboard/OperationLogsManager';
import { loadOperationLogsAccessContext } from '@/lib/operation-logs/load-access-context';
import { redirectForLoaderError } from '@/lib/premium/page-gate';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';

export default async function OperationLogsPage({ params }: { params: { slug: string } }) {
  const store = await requireDashboardStore(params.slug);
  const ctx = await loadOperationLogsAccessContext(store.restaurant.id);
  if ('error' in ctx) {
    redirectForLoaderError(ctx, store.restaurant.slug);
  }

  return <OperationLogsManager restaurantId={ctx.restaurantId} retentionDays={ctx.retentionDays} />;
}
