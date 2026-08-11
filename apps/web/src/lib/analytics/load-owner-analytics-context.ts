import 'server-only';

import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import { resolveDashboardCapabilityAccess } from '@/lib/dashboard-capability-access';
import { premiumLoaderCheck } from '@/lib/premium/access';
import { NAV_PERMISSION } from '@/lib/permissions/registry';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';

export type OwnerAnalyticsContext =
  | { admin: SupabaseClient; restaurantId: string; userId: string }
  | { error: string; status: number; message?: string; premiumKey?: import('@mesa/shared').PremiumKey };

export async function loadOwnerAnalyticsContext(): Promise<OwnerAnalyticsContext> {
  const access = await getDashboardAccess();
  const loaded = await loadPrincipalWithCapabilities();
  const gate = resolveDashboardCapabilityAccess(
    access,
    loaded?.capabilities ?? null,
    NAV_PERMISSION.valueAnalytics,
  );
  if (!gate.ok) {
    return { error: gate.error, status: gate.status };
  }
  if (!loaded) {
    return { error: 'unauthorized', status: 401 };
  }
  if (access.mode !== 'owner' && access.mode !== 'staff') {
    return { error: 'unauthorized', status: 401 };
  }
  const premiumBlock = await premiumLoaderCheck(access.restaurant, 'value_analytics');
  if (premiumBlock) return premiumBlock;

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
