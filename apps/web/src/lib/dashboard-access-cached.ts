import 'server-only';

import { cache } from 'react';
import {
  loadDashboardAccess,
  loadDashboardFloorStaffContext,
  loadFrontdeskOperationalContext,
  resolveOverviewDashboardContext,
  type FrontdeskOperationalContext,
} from '@/lib/dashboard-access';

/** Per-request dedup for dashboard layout + page (server components only). */
export const getDashboardAccess = cache(loadDashboardAccess);

/** Per-request dedup for frontdesk operational pages and matching APIs. */
export const getDashboardFloorStaffContext = cache(loadDashboardFloorStaffContext);

export const getFrontdeskOperationalContext = cache(loadFrontdeskOperationalContext);

/** Overview / order-history admin context — reuses layout access (no second auth round-trip). */
export async function getOverviewDashboardContext(): Promise<FrontdeskOperationalContext> {
  return resolveOverviewDashboardContext(await getDashboardAccess(), () =>
    getFrontdeskOperationalContext(),
  );
}
