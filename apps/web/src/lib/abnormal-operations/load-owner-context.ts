import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadOwnerDashboardAuditActor } from '@/lib/audit/load-owner-dashboard-actor';
import type { AuditActor } from '@/lib/audit/types';
import { loadDashboardAccess } from '@/lib/dashboard-access';

export type OwnerAbnormalOperationsContext =
  | {
      admin: SupabaseClient;
      restaurantId: string;
      userId: string;
      actor: AuditActor;
    }
  | { error: string; status: number };

export async function loadOwnerAbnormalOperationsContext(): Promise<OwnerAbnormalOperationsContext> {
  const access = await loadDashboardAccess();
  if (access.mode !== 'owner') {
    return { error: 'forbidden', status: 403 };
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
  };
}
