import { DashboardWaiterFloorShell } from '@/components/waiter/DashboardWaiterFloorShell';
import { requireWaiterBoardDashboardAccess } from '@/lib/dashboard-page-access';
import { toFloorBoardRestaurant } from '@/lib/floor-board-restaurant';

export default async function DashboardWaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { restaurant, floorCapabilities, capabilities } =
    await requireWaiterBoardDashboardAccess();

  return (
    <DashboardWaiterFloorShell
      restaurant={toFloorBoardRestaurant(restaurant)}
      floorCapabilities={floorCapabilities}
      capabilities={capabilities}
    >
      {children}
    </DashboardWaiterFloorShell>
  );
}
