import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  loadDashboardAccess,
  type DashboardOperationalContext,
} from '@/lib/dashboard-access';
import { resolveDashboardOperationalContext } from '@/lib/dashboard-operational-context';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import type { PermissionKey } from '@/lib/permissions/registry';
import { createAdminClient } from '@/lib/supabase/admin';

export type { DashboardOperationalContext };

/** Server-side admin context for dashboard operational pages and APIs (overview, orders, tables, menu). */
export async function loadDashboardOperationalContext(
  permission: PermissionKey,
  options?: { requireWritable?: boolean },
): Promise<DashboardOperationalContext> {
  const access = await loadDashboardAccess();
  const loaded = await loadPrincipalWithCapabilities();
  const resolved = resolveDashboardOperationalContext(
    access,
    loaded?.capabilities ?? null,
    permission,
    options,
  );
  if ('error' in resolved) {
    return resolved;
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'server_misconfigured', status: 503 };
  }

  return { admin, restaurantId: resolved.restaurantId };
}

export type WritableOperationalAdmin = {
  admin: SupabaseClient;
  restaurantId: string;
};
