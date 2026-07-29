import 'server-only';

import { cache } from 'react';
import { loadDashboardAccess } from '@/lib/dashboard-access';
import { loadDashboardOperationalContext } from '@/lib/dashboard-operational-load';

/** Per-request dedup for dashboard layout + page (server components only). */
export const getDashboardAccess = cache(loadDashboardAccess);

/** Per-request dedup for operational dashboard pages and matching APIs. */
export const getDashboardOperationalContext = cache(loadDashboardOperationalContext);
