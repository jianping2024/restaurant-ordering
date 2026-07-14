import { DashboardWaiterFloorShell } from '@/components/waiter/DashboardWaiterFloorShell';
import { requireWaiterBoardDashboardAccess } from '@/lib/dashboard-page-access';

export default async function DashboardWaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const restaurant = await requireWaiterBoardDashboardAccess();

  return (
    <DashboardWaiterFloorShell
      restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug }}
    >
      {children}
    </DashboardWaiterFloorShell>
  );
}
