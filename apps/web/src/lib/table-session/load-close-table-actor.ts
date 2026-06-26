import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isRestaurantSuspended } from '@mesa/shared';
import {
  frontdeskAuditActor,
  ownerAuditActor,
  resolveOwnerOperatorName,
} from '@/lib/audit';
import type { AuditActor } from '@/lib/audit/types';
import { loadDashboardAccess, loadFrontdeskOperationalContext } from '@/lib/dashboard-access';

export type CloseTableSessionActorContext =
  | {
      admin: SupabaseClient;
      restaurantId: string;
      userId: string;
      actor: AuditActor;
      closedReason: 'owner_closed' | 'frontdesk_closed';
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

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: 'unauthorized', status: 401 };
    }

    return {
      admin,
      restaurantId: access.restaurant.id,
      userId: user.id,
      actor: ownerAuditActor(
        user.id,
        resolveOwnerOperatorName(access.restaurant.name, user.email),
      ),
      closedReason: 'owner_closed',
    };
  }

  const frontdesk = await loadFrontdeskOperationalContext(options);
  if ('error' in frontdesk) {
    return { error: frontdesk.error, status: frontdesk.status };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'unauthorized', status: 401 };
  }

  const { data: account } = await frontdesk.admin
    .from('restaurant_staff_accounts')
    .select('display_name')
    .eq('restaurant_id', frontdesk.restaurantId)
    .eq('user_id', user.id)
    .maybeSingle();

  const displayName = (account?.display_name as string | undefined)?.trim() || 'Front desk';

  return {
    admin: frontdesk.admin,
    restaurantId: frontdesk.restaurantId,
    userId: user.id,
    actor: frontdeskAuditActor(user.id, displayName),
    closedReason: 'frontdesk_closed',
  };
}
