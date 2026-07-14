import 'server-only';

import { cache } from 'react';
import { loadDashboardAccess, loadDashboardFloorStaffContext, loadFrontdeskOperationalContext } from '@/lib/dashboard-access';

/** Per-request dedup for dashboard layout + page (server components only). */
export const getDashboardAccess = cache(loadDashboardAccess);

/** Per-request dedup for frontdesk operational pages and matching APIs. */
export const getDashboardFloorStaffContext = cache(loadDashboardFloorStaffContext);

export const getFrontdeskOperationalContext = cache(loadFrontdeskOperationalContext);
