import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { loadClaimedOnPremRestaurant } from '@/lib/auth/prem-builtin-admin';
import { isPremBuiltinAdminActor } from '@/lib/auth/prem-builtin-admin-identity';
import {
  normalizeStaffGateRow,
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

export async function loadOwnedRestaurantForUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ id: string; slug: string } | null> {
  const { data, error } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id || typeof data.slug !== 'string') return null;
  return { id: data.id as string, slug: data.slug };
}

/**
 * Sole backend-admin restaurant access for a session user:
 * true restaurants.owner_id match, else prem built-in admin after claim.
 * Never assigns or changes owner_id.
 */
export async function loadBackendAdminRestaurantForUser(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    userId: string;
    email?: string | null;
    userMetadata?: Record<string, unknown> | null;
  },
): Promise<{ id: string; slug: string } | null> {
  const owned = await loadOwnedRestaurantForUser(admin, params.userId);
  if (owned) return owned;

  if (
    !isPremBuiltinAdminActor({
      email: params.email,
      userMetadata: params.userMetadata,
    })
  ) {
    return null;
  }

  return loadClaimedOnPremRestaurant(admin);
}

export async function loadOwnerForSlug(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  slug: string,
): Promise<OwnerGateRestaurant | null> {
  const { data } = await admin
    .from('restaurants')
    .select('id, slug, suspended_at')
    .eq('slug', slug)
    .eq('owner_id', userId)
    .maybeSingle();
  return (data as OwnerGateRestaurant | null) ?? null;
}

export async function loadOwnerForRestaurantId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  restaurantId: string,
): Promise<Pick<OwnerGateRestaurant, 'id' | 'slug'> | null> {
  const { data } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('id', restaurantId)
    .eq('owner_id', userId)
    .maybeSingle();
  return (data as Pick<OwnerGateRestaurant, 'id' | 'slug'> | null) ?? null;
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
