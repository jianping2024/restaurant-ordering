import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRestaurantSuspended } from '@mesa/shared';
import { loadStaffAuditActor } from '@/lib/audit/resolve-actor';
import { loadOwnerDashboardAuditActor } from '@/lib/audit/load-owner-dashboard-actor';
import type { AuditActor } from '@/lib/audit/types';
import { loadDashboardAccess } from '@/lib/dashboard-access';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import type { SettledCloseActorReason } from '@/lib/table-session/operational-close-reasons';
import {
  resolveCloseTableSessionDeskActor,
  type CloseTableSessionActorGate,
} from '@/lib/table-session/resolve-close-table-actor';

export type CloseTableSessionActorContext =
  | {
      admin: SupabaseClient;
      restaurantId: string;
      userId: string;
      actor: AuditActor;
      closedReason: SettledCloseActorReason;
    }
  | { error: string; status: number };

export type { CloseTableSessionActorGate };

export async function loadCloseTableSessionActor(options?: {
  requireWritable?: boolean;
  gate?: CloseTableSessionActorGate;
}): Promise<CloseTableSessionActorContext> {
  const access = await loadDashboardAccess();
  if (access.mode === 'owner') {
    if (
      options?.requireWritable &&
      isRestaurantSuspended(access.restaurant.suspended_at)
    ) {
      return { error: 'restaurant_suspended', status: 403 };
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { error: 'server_misconfigured', status: 503 };
    }

    const ownerActor = await loadOwnerDashboardAuditActor(access.restaurant);
    if (!ownerActor) {
      return { error: 'unauthorized', status: 401 };
    }

    return {
      admin,
      restaurantId: access.restaurant.id,
      userId: ownerActor.userId,
      actor: ownerActor.actor,
      closedReason: 'owner_closed',
    };
  }

  const loaded = await loadPrincipalWithCapabilities();
  const desk = resolveCloseTableSessionDeskActor(
    access,
    loaded,
    options?.gate ?? 'checkout_close',
    options,
  );
  if (!desk.ok) {
    return { error: desk.error, status: desk.status };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'server_misconfigured', status: 503 };
  }

  const actor = await loadStaffAuditActor(admin, {
    restaurantId: desk.restaurantId,
    userId: desk.userId,
    role: desk.staffRole,
  });

  return {
    admin,
    restaurantId: desk.restaurantId,
    userId: desk.userId,
    actor,
    closedReason: desk.closedReason,
  };
}
