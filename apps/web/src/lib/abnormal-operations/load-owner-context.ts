import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadOwnerDashboardAuditActor } from '@/lib/audit/load-owner-dashboard-actor';
import { loadStaffAuditActor } from '@/lib/audit/resolve-actor';
import type { AuditActor } from '@/lib/audit/types';
import { loadDashboardAccess } from '@/lib/dashboard-access';
import { resolveDashboardCapabilityAccess } from '@/lib/dashboard-capability-access';
import { NAV_PERMISSION } from '@/lib/permissions/registry';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';

export type OwnerAbnormalOperationsContext =
  | {
      admin: SupabaseClient;
      restaurantId: string;
      restaurantSlug: string;
      userId: string;
      actor: AuditActor;
    }
  | { error: string; status: number };

export async function loadOwnerAbnormalOperationsContext(): Promise<OwnerAbnormalOperationsContext> {
  const access = await loadDashboardAccess();
  const loaded = await loadPrincipalWithCapabilities();
  const gate = resolveDashboardCapabilityAccess(
    access,
    loaded?.capabilities ?? null,
    NAV_PERMISSION.abnormalOps,
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

  const restaurantSlug = access.restaurant.slug;

  if (loaded.principal.kind === 'owner') {
    const ownerActor = await loadOwnerDashboardAuditActor(access.restaurant);
    if (!ownerActor) {
      return { error: 'unauthorized', status: 401 };
    }
    return {
      admin,
      restaurantId: gate.restaurantId,
      restaurantSlug,
      userId: ownerActor.userId,
      actor: ownerActor.actor,
    };
  }

  const staffRole =
    loaded.principal.presetKey === 'owner'
      ? 'owner'
      : loaded.principal.staffRoleLabel || loaded.principal.presetKey || 'staff';
  const actor = await loadStaffAuditActor(admin, {
    restaurantId: gate.restaurantId,
    userId: loaded.principal.userId,
    role: staffRole,
  });

  return {
    admin,
    restaurantId: gate.restaurantId,
    restaurantSlug,
    userId: loaded.principal.userId,
    actor,
  };
}
