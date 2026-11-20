import type { AuthorizedRestaurantId } from '@/lib/permissions/authorized-restaurant-id';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadOwnerDashboardAuditActor } from '@/lib/audit/load-owner-dashboard-actor';
import { loadStaffAuditActor } from '@/lib/audit/resolve-actor';
import type { AuditActor } from '@/lib/audit/types';
import { dashboardAccessPrincipal } from '@/lib/dashboard-access';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import { resolveDashboardCapabilityAccess } from '@/lib/dashboard-capability-access';
import { premiumLoaderCheck } from '@/lib/premium/access';
import { NAV_PERMISSION } from '@/lib/permissions/registry';

export type OwnerAbnormalOperationsContext =
  | {
      admin: SupabaseClient;
      restaurantId: AuthorizedRestaurantId;
      restaurantSlug: string;
      userId: string;
      actor: AuditActor;
    }
  | { error: string; status: number; premiumKey?: import('@mesa/shared').PremiumKey };

export async function loadOwnerAbnormalOperationsContext(
  restaurantId: string,
): Promise<OwnerAbnormalOperationsContext> {
  const access = await getDashboardAccess(restaurantId);
  const loaded = dashboardAccessPrincipal(access);
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
    access.mode === 'forbidden' ||
    access.mode === 'access_error'
  ) {
    return { error: 'unauthorized', status: 401 };
  }

  const premiumBlock = await premiumLoaderCheck(access.restaurant, 'abnormal_ops');
  if (premiumBlock) return premiumBlock;

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
