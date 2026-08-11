import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadDashboardAccess } from '@/lib/dashboard-access';
import { resolveDashboardCapabilityAccess } from '@/lib/dashboard-capability-access';
import { resolveOperationLogRetentionDays } from '@/lib/operation-logs/retention-days';
import { NAV_PERMISSION } from '@/lib/permissions/registry';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';

export type OperationLogsAccessContext =
  | {
      admin: SupabaseClient;
      restaurantId: string;
      restaurantSlug: string;
      userId: string;
      retentionDays: number;
    }
  | { error: string; status: number };

export async function loadOperationLogsAccessContext(): Promise<OperationLogsAccessContext> {
  const access = await loadDashboardAccess();
  const loaded = await loadPrincipalWithCapabilities();
  const gate = resolveDashboardCapabilityAccess(
    access,
    loaded?.capabilities ?? null,
    NAV_PERMISSION.operationLogs,
  );
  if (!gate.ok) {
    return { error: gate.error, status: gate.status };
  }
  if (
    !loaded ||
    access.mode === 'unauthenticated' ||
    access.mode === 'onboarding' ||
    access.mode === 'access_error'
  ) {
    return { error: 'unauthorized', status: 401 };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'server_misconfigured', status: 503 };
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from('restaurants')
    .select('operation_log_retention_days')
    .eq('id', gate.restaurantId)
    .maybeSingle();

  if (restaurantError) {
    return { error: 'query_failed', status: 500 };
  }

  return {
    admin,
    restaurantId: gate.restaurantId,
    restaurantSlug: access.restaurant.slug,
    userId: loaded.principal.userId,
    retentionDays: resolveOperationLogRetentionDays(restaurant?.operation_log_retention_days),
  };
}
