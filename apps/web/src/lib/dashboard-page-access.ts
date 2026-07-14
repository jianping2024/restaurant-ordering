import { redirect } from 'next/navigation';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import type { DashboardAccess } from '@/lib/dashboard-access';

type WaiterBoardDashboardAccess = Extract<DashboardAccess, { mode: 'frontdesk' | 'cashier' }>;

/** Dashboard embedded waiter board — frontdesk and cashier (shares cached auth with layout). */
export async function requireWaiterBoardDashboardAccess(): Promise<
  WaiterBoardDashboardAccess['restaurant']
> {
  const access = await getDashboardAccess();
  if (access.mode !== 'frontdesk' && access.mode !== 'cashier') {
    redirect('/dashboard');
  }
  return access.restaurant;
}
