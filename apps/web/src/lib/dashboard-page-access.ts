import { redirect } from 'next/navigation';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import { floorBoardCapabilitiesFromCaps } from '@/lib/permissions/resolve';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import {
  resolveWaiterBoardDashboardAccess,
  type WaiterBoardDashboardContext,
} from '@/lib/dashboard-waiter-board-access';

export type { WaiterBoardDashboardContext } from '@/lib/dashboard-waiter-board-access';

/** Dashboard floor board — requires dashboard.waiter_board.view capability. */
export async function requireWaiterBoardDashboardAccess(): Promise<WaiterBoardDashboardContext> {
  const access = await getDashboardAccess();
  const loaded = await loadPrincipalWithCapabilities();
  const decision = resolveWaiterBoardDashboardAccess(access, loaded?.capabilities ?? null);
  if (!decision.ok) {
    redirect(decision.redirectTo);
  }

  return {
    restaurant: decision.restaurant,
    capabilities: loaded!.capabilities,
    floorCapabilities: floorBoardCapabilitiesFromCaps(loaded!.capabilities),
  };
}
