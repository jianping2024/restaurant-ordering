import { notFound, redirect } from 'next/navigation';
import { AbnormalOperationsManager } from '@/components/dashboard/AbnormalOperationsManager';
import { loadDashboardAccess } from '@/lib/dashboard-access';

export default async function AbnormalOperationsPage() {
  const access = await loadDashboardAccess();
  if (access.mode === 'unauthenticated') {
    redirect('/auth/login');
  }
  if (access.mode !== 'owner') {
    notFound();
  }

  return <AbnormalOperationsManager />;
}
