import 'server-only';

import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import {
  loadDashboardAccess,
  type DashboardAccess,
} from '@/lib/dashboard-access';
import { DASHBOARD_ENTRY_PATH } from '@/lib/dashboard-store-routes';
import { loadRestaurantRefBySlug } from '@/lib/staff-gate-db';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadDashboardOperationalContext } from '@/lib/dashboard-operational-load';

/** Per-request dedup for dashboard layout + page (server components only), per store id. */
export const getDashboardAccess = cache(loadDashboardAccess);

/**
 * Store layout gate: URL slug → this store's access. Unknown slug / no access → store-less
 * entry (lands on the account's store); signed out → login. A store-row load error is
 * returned so the layout can show `DashboardAccessError` (current behavior).
 */
export const resolveDashboardStore = cache(
  async (slug: string): Promise<DashboardAccess | { mode: 'access_error'; message: string }> => {
    const ref = await loadRestaurantRefBySlug(createAdminClient(), slug);
    if (!ref) redirect(DASHBOARD_ENTRY_PATH);
    const access = await getDashboardAccess(ref.id);
    if (access.mode === 'unauthenticated') redirect('/auth/login');
    if (access.mode === 'forbidden') redirect(DASHBOARD_ENTRY_PATH);
    return access;
  },
);

/** Store page gate (pages under the layout): same load; a store-row error is a 404. */
export async function requireDashboardStore(slug: string): Promise<DashboardAccess> {
  const access = await resolveDashboardStore(slug);
  if (access.mode === 'access_error') notFound();
  return access;
}

/** Per-request dedup for operational dashboard pages and matching APIs. */
export const getDashboardOperationalContext = cache(loadDashboardOperationalContext);
