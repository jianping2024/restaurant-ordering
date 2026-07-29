import 'server-only';

import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import {
  OWNER_TOOL_PERMISSIONS,
  resolveOwnerToolCapabilityAccess,
} from '@/lib/dashboard-owner-tool-access';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';

export type OwnerAnalyticsContext =
  | { admin: SupabaseClient; restaurantId: string; userId: string }
  | { error: string; status: number; message?: string };

export async function loadOwnerAnalyticsContext(): Promise<OwnerAnalyticsContext> {
  const access = await getDashboardAccess();
  const loaded = await loadPrincipalWithCapabilities();
  const gate = resolveOwnerToolCapabilityAccess(
    access,
    loaded?.capabilities ?? null,
    OWNER_TOOL_PERMISSIONS.valueAnalytics,
  );
  if (!gate.ok) {
    return { error: gate.error, status: gate.status };
  }
  if (!loaded) {
    return { error: 'unauthorized', status: 401 };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'server_misconfigured', status: 503 };
  }

  return {
    admin,
    restaurantId: gate.restaurantId,
    userId: loaded.principal.userId,
  };
}

/** Per-request dedup when dashboard layout and value-analytics page load together. */
export const getOwnerAnalyticsContext = cache(loadOwnerAnalyticsContext);
