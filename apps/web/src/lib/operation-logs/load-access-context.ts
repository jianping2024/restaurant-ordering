import type { AuthorizedRestaurantId } from '@/lib/permissions/authorized-restaurant-id';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { dashboardAccessPrincipal } from '@/lib/dashboard-access';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import { resolveDashboardCapabilityAccess } from '@/lib/dashboard-capability-access';
import { premiumLoaderCheck } from '@/lib/premium/access';
import { resolveOperationLogRetentionDays } from '@/lib/operation-logs/retention-days';
import { NAV_PERMISSION } from '@/lib/permissions/registry';

export type OperationLogsAccessContext =
  | {
      admin: SupabaseClient;
      restaurantId: AuthorizedRestaurantId;
      restaurantSlug: string;
      userId: string;
      retentionDays: number;
    }
  | { error: string; status: number; premiumKey?: import('@mesa/shared').PremiumKey };

export async function loadOperationLogsAccessContext(
  restaurantId: string,
): Promise<OperationLogsAccessContext> {
  const access = await getDashboardAccess(restaurantId);
  const loaded = dashboardAccessPrincipal(access);
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
    access.mode === 'forbidden' ||
    access.mode === 'access_error'
  ) {
    return { error: 'unauthorized', status: 401 };
  }

  const premiumBlock = await premiumLoaderCheck(access.restaurant, 'operation_logs');
  if (premiumBlock) return premiumBlock;

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
