import { redirect } from 'next/navigation';
import { DashboardWaiterFloorShell } from '@/components/waiter/DashboardWaiterFloorShell';
import { loadDashboardAccess } from '@/lib/dashboard-access';
import { loadWaiterBoardInitial } from '@/lib/staff-board';

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
  let board;
  try {
    board = await loadWaiterBoardInitial(restaurant.id);
  } catch {
    board = null;
  }

  return (
    <DashboardWaiterFloorShell
      restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug }}
      board={board}
    >
      {children}
    </DashboardWaiterFloorShell>
  );
}
