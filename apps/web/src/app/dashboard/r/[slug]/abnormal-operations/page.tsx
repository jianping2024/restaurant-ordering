import { AbnormalOperationsManager } from '@/components/dashboard/AbnormalOperationsManager';
import { loadOwnerAbnormalOperationsContext } from '@/lib/abnormal-operations/load-owner-context';
import { redirectForLoaderError } from '@/lib/premium/page-gate';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';

export default async function AbnormalOperationsPage({ params }: { params: { slug: string } }) {
  const store = await requireDashboardStore(params.slug);
  const ctx = await loadOwnerAbnormalOperationsContext(store.restaurant.id);
  if ('error' in ctx) {
    redirectForLoaderError(ctx, store.restaurant.slug);
  }

  return (
    <AbnormalOperationsManager
      restaurantId={ctx.restaurantId}
      restaurantSlug={ctx.restaurantSlug}
    />
  );
}
