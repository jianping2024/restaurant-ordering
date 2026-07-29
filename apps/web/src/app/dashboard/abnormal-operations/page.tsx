import { redirect } from 'next/navigation';
import { AbnormalOperationsManager } from '@/components/dashboard/AbnormalOperationsManager';
import { loadOwnerAbnormalOperationsContext } from '@/lib/abnormal-operations/load-owner-context';

export default async function AbnormalOperationsPage() {
  const ctx = await loadOwnerAbnormalOperationsContext();
  if ('error' in ctx) {
    if (ctx.status === 401) redirect('/auth/login');
    redirect('/dashboard');
  }

  return <AbnormalOperationsManager restaurantSlug={ctx.restaurantSlug} />;
}
