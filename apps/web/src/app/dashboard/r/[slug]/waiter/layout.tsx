import { DashboardWaiterFloorShell } from '@/components/waiter/DashboardWaiterFloorShell';
import { requireWaiterBoardDashboardAccess } from '@/lib/dashboard-page-access';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';
import { loadFloorBoardRestaurant } from '@/lib/floor-board-restaurant';
import { toCapabilitiesPayload } from '@/lib/permissions/can';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function DashboardWaiterLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const store = await requireDashboardStore(params.slug);
  const { restaurant, floorCapabilities, capabilities } =
    await requireWaiterBoardDashboardAccess(store.restaurant.id);
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
