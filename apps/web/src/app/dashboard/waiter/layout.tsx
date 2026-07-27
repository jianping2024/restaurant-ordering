import { DashboardWaiterFloorShell } from '@/components/waiter/DashboardWaiterFloorShell';
import { requireWaiterBoardDashboardAccess } from '@/lib/dashboard-page-access';
import { toFloorBoardRestaurant } from '@/lib/floor-board-restaurant';

export default async function DashboardWaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { restaurant, mode } = await requireWaiterBoardDashboardAccess();

  return (
    <DashboardWaiterFloorShell
      restaurant={toFloorBoardRestaurant(restaurant)}
      floorStaffRole={mode}
    >
      {children}
    </DashboardWaiterFloorShell>
  );
}
