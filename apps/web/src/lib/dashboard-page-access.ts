import { redirect } from 'next/navigation';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import type { FrontdeskDashboardRestaurant } from '@/lib/dashboard-access';

/** Frontdesk waiter pages — shares cached auth with dashboard layout (one auth chain per request). */
export async function requireFrontdeskRestaurant(): Promise<
  FrontdeskDashboardRestaurant & { name: string }
> {
  const access = await getDashboardAccess();
  if (access.mode !== 'frontdesk') {
    redirect('/dashboard');
  }
  return access.restaurant;
}
