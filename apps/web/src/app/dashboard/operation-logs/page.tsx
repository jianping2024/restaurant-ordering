import { OperationLogsManager } from '@/components/dashboard/OperationLogsManager';
import { loadOperationLogsAccessContext } from '@/lib/operation-logs/load-access-context';
import { redirectForLoaderError } from '@/lib/premium/page-gate';

export default async function OperationLogsPage() {
  const ctx = await loadOperationLogsAccessContext();
  if ('error' in ctx) {
    redirectForLoaderError(ctx);
  }

  return <OperationLogsManager restaurantId={ctx.restaurantId} retentionDays={ctx.retentionDays} />;
}
