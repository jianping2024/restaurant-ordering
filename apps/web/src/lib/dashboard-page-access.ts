import { redirect } from 'next/navigation';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import type { DashboardAccess } from '@/lib/dashboard-access';
import type { FloorBoardRole } from '@/lib/floor-board-capabilities';

type WaiterBoardDashboardAccess = Extract<
  DashboardAccess,
  { mode: 'frontdesk' | 'cashier' | 'waiter' }
>;

export type WaiterBoardDashboardContext = {
  mode: FloorBoardRole;
  restaurant: WaiterBoardDashboardAccess['restaurant'];
};

/** Dashboard floor board — frontdesk, cashier, and waiter (shares cached auth with layout). */
export async function requireWaiterBoardDashboardAccess(): Promise<WaiterBoardDashboardContext> {
  const access = await getDashboardAccess();
  if (access.mode !== 'frontdesk' && access.mode !== 'cashier' && access.mode !== 'waiter') {
    redirect('/dashboard');
  }
  return { mode: access.mode, restaurant: access.restaurant };
}
