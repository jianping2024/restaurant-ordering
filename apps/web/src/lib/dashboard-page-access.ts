import { redirect } from 'next/navigation';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import type { DashboardAccess } from '@/lib/dashboard-access';
import { can, type Capabilities } from '@/lib/permissions/can';
import {
  floorBoardCapabilitiesFromCaps,
  type FloorBoardCapabilities,
} from '@/lib/permissions/resolve';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';

type WaiterBoardDashboardAccess = Extract<
  DashboardAccess,
  { mode: 'frontdesk' | 'cashier' | 'waiter' }
>;

export type WaiterBoardDashboardContext = {
  restaurant: WaiterBoardDashboardAccess['restaurant'];
  capabilities: Capabilities;
  floorCapabilities: FloorBoardCapabilities;
};

/** Dashboard floor board — requires dashboard.waiter_board.view capability. */
export async function requireWaiterBoardDashboardAccess(): Promise<WaiterBoardDashboardContext> {
  const access = await getDashboardAccess();
  if (access.mode !== 'frontdesk' && access.mode !== 'cashier' && access.mode !== 'waiter') {
    redirect('/dashboard');
  }

  const loaded = await loadPrincipalWithCapabilities();
  if (!loaded || !can(loaded.capabilities, 'dashboard.waiter_board.view')) {
    redirect('/dashboard');
  }

  return {
    restaurant: access.restaurant,
    capabilities: loaded.capabilities,
    floorCapabilities: floorBoardCapabilitiesFromCaps(loaded.capabilities),
  };
}
