import { redirect } from 'next/navigation';
import { DashboardWaiterFloorShell } from '@/components/waiter/DashboardWaiterFloorShell';
import { loadDashboardAccess } from '@/lib/dashboard-access';

export default async function DashboardWaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await loadDashboardAccess();
  if (access.mode !== 'frontdesk') {
    redirect('/dashboard');
  }

  const { restaurant } = access;

  return (
    <DashboardWaiterFloorShell
      restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug }}
    >
      {children}
    </DashboardWaiterFloorShell>
  );
}
