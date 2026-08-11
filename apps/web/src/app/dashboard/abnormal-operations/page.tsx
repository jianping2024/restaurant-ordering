import { AbnormalOperationsManager } from '@/components/dashboard/AbnormalOperationsManager';
import { loadOwnerAbnormalOperationsContext } from '@/lib/abnormal-operations/load-owner-context';
import { redirectForLoaderError } from '@/lib/premium/page-gate';

export default async function AbnormalOperationsPage() {
  const ctx = await loadOwnerAbnormalOperationsContext();
  if ('error' in ctx) {
    redirectForLoaderError(ctx);
  }

  return (
    <AbnormalOperationsManager
      restaurantId={ctx.restaurantId}
      restaurantSlug={ctx.restaurantSlug}
    />
  );
}
