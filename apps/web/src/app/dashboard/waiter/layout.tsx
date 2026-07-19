import { DashboardWaiterFloorShell } from '@/components/waiter/DashboardWaiterFloorShell';
import { requireWaiterBoardDashboardAccess } from '@/lib/dashboard-page-access';

export default async function DashboardWaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { restaurant, mode } = await requireWaiterBoardDashboardAccess();

  return (
    <DashboardWaiterFloorShell
      restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug }}
      floorStaffRole={mode}
    >
      {children}
    </DashboardWaiterFloorShell>
  );
}
