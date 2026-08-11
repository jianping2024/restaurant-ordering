import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadDashboardAccess } from '@/lib/dashboard-access';
import { resolveDashboardCapabilityAccess } from '@/lib/dashboard-capability-access';
import { isOperationLogsHostEnabled } from '@/lib/operation-logs/access';
import { NAV_PERMISSION } from '@/lib/permissions/registry';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';

export type OperationLogsAccessContext =
  | {
      admin: SupabaseClient;
      restaurantId: string;
      restaurantSlug: string;
      userId: string;
    }
  | { error: string; status: number };

export async function loadOperationLogsAccessContext(): Promise<OperationLogsAccessContext> {
  if (!isOperationLogsHostEnabled()) {
    return { error: 'not_found', status: 404 };
  }

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

  return {
    admin,
    restaurantId: gate.restaurantId,
    restaurantSlug: access.restaurant.slug,
    userId: loaded.principal.userId,
  };
}
