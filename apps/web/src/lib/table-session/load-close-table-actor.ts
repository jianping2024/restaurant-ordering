import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isRestaurantSuspended } from '@mesa/shared';
import { loadStaffAuditActor } from '@/lib/audit/resolve-actor';
import { loadOwnerDashboardAuditActor } from '@/lib/audit/load-owner-dashboard-actor';
import type { AuditActor } from '@/lib/audit/types';
import { loadDashboardAccess, loadDashboardFloorStaffContext } from '@/lib/dashboard-access';

export type CloseTableSessionClosedReason =
  | 'owner_closed'
  | 'frontdesk_closed'
  | 'cashier_closed';

export type CloseTableSessionActorContext =
  | {
      admin: SupabaseClient;
      restaurantId: string;
      userId: string;
      actor: AuditActor;
      closedReason: CloseTableSessionClosedReason;
    }
  | { error: string; status: number };

export async function loadCloseTableSessionActor(options?: {
  requireWritable?: boolean;
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

  const floorStaff = await loadDashboardFloorStaffContext(options);
  if ('error' in floorStaff) {
    return { error: floorStaff.error, status: floorStaff.status };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'unauthorized', status: 401 };
  }

  const actor = await loadStaffAuditActor(floorStaff.admin, {
    restaurantId: floorStaff.restaurantId,
    userId: user.id,
    role: floorStaff.role,
  });

  return {
    admin: floorStaff.admin,
    restaurantId: floorStaff.restaurantId,
    userId: user.id,
    actor,
    closedReason: floorStaff.role === 'cashier' ? 'cashier_closed' : 'frontdesk_closed',
  };
}
