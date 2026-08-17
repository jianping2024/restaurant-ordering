import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { loadClaimedOnPremRestaurant } from '@/lib/auth/prem-builtin-admin';
import { isPremBuiltinAdminActor } from '@/lib/auth/prem-builtin-admin-identity';
import {
  normalizeStaffGateRow,
  resolveOwnerRestaurantFromLoads,
  type OwnerGateRestaurant,
  type StaffGateAccount,
} from '@/lib/staff-identity-gate';

export const STAFF_GATE_SELECT =
  'id, restaurant_id, role, role_id, disabled_at, restaurants(id, slug, suspended_at)';

/** Shared staff+restaurant gate row (admin). Safe for Node routes and Edge middleware. */
export async function loadStaffGateAccountForUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<StaffGateAccount | null> {
  const { data, error } = await admin
    .from('restaurant_staff_accounts')
    .select(STAFF_GATE_SELECT)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return normalizeStaffGateRow(data);
}

function asOwnerGateRestaurant(row: {
  id: unknown;
  slug: unknown;
  suspended_at?: unknown;
}): OwnerGateRestaurant | null {
  if (typeof row.id !== 'string' || typeof row.slug !== 'string') return null;
  return {
    id: row.id,
    slug: row.slug,
    suspended_at: (row.suspended_at as string | null | undefined) ?? null,
  };
}

/**
 * Sole owner restaurant for a session user: `restaurants.owner_id`, else the
 * on-prem shadow login (`admin`) after claim. Never assigns or changes owner_id.
 */
export async function loadOwnerRestaurantForUser(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    userId: string;
    email?: string | null;
    userMetadata?: Record<string, unknown> | null;
  },
): Promise<OwnerGateRestaurant | null> {
  const { data, error } = await admin
    .from('restaurants')
    .select('id, slug, suspended_at')
    .eq('owner_id', params.userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  const ownedByOwnerId = data ? asOwnerGateRestaurant(data) : null;
  const isOwnerShadow = isPremBuiltinAdminActor({
    email: params.email,
    userMetadata: params.userMetadata,
  });
  const claimedRestaurant =
    !ownedByOwnerId && isOwnerShadow
      ? await loadClaimedOnPremRestaurant(admin)
      : null;

  return resolveOwnerRestaurantFromLoads({
    ownedByOwnerId,
    isOwnerShadow,
    claimedRestaurant,
  });
}

export async function loadStaffGateByUserId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<StaffGateAccount | null> {
  const { data } = await admin
    .from('restaurant_staff_accounts')
    .select(STAFF_GATE_SELECT)
    .eq('user_id', userId)
    .maybeSingle();
  return normalizeStaffGateRow(data);
}
