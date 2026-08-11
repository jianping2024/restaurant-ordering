import { redirect } from 'next/navigation';
import { OperationLogsManager } from '@/components/dashboard/OperationLogsManager';
import { loadOperationLogsAccessContext } from '@/lib/operation-logs/load-access-context';

export default async function OperationLogsPage() {
  const ctx = await loadOperationLogsAccessContext();
  if ('error' in ctx) {
    if (ctx.status === 401) redirect('/auth/login');
    redirect('/dashboard');
  }

  return <OperationLogsManager restaurantId={ctx.restaurantId} retentionDays={ctx.retentionDays} />;
}
