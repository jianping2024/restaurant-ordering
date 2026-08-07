import { DashboardWaiterFloorShell } from '@/components/waiter/DashboardWaiterFloorShell';
import { requireWaiterBoardDashboardAccess } from '@/lib/dashboard-page-access';
import { loadFloorBoardRestaurant } from '@/lib/floor-board-restaurant';
import { toCapabilitiesPayload } from '@/lib/permissions/can';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function DashboardWaiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { restaurant, floorCapabilities, capabilities } =
    await requireWaiterBoardDashboardAccess();
  const admin = createAdminClient();
  const floorRestaurant = await loadFloorBoardRestaurant(admin, restaurant);

  return (
    <DashboardWaiterFloorShell
      restaurant={floorRestaurant}
      floorCapabilities={floorCapabilities}
      capabilities={toCapabilitiesPayload(capabilities)}
    >
      {children}
    </DashboardWaiterFloorShell>
  );
}
