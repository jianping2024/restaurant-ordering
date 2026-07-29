import 'server-only';

import { cache } from 'react';
import {
  loadDashboardAccess,
  loadDashboardOperationalContext,
} from '@/lib/dashboard-access';

/** Per-request dedup for dashboard layout + page (server components only). */
export const getDashboardAccess = cache(loadDashboardAccess);

/** Per-request dedup for operational dashboard pages and matching APIs. */
export const getDashboardOperationalContext = cache(loadDashboardOperationalContext);
