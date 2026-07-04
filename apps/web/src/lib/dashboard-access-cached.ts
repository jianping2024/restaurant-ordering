import 'server-only';

import { cache } from 'react';
import { loadDashboardAccess } from '@/lib/dashboard-access';

/** Per-request dedup for dashboard layout + page (server components only). */
export const getDashboardAccess = cache(loadDashboardAccess);
