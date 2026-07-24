import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  normalizeStaffGateRow,
  type OwnerGateRestaurant,
  type StaffGateAccount,
} from '@/lib/staff-identity-gate';

export const STAFF_GATE_SELECT =
  'id, restaurant_id, role, disabled_at, restaurants(id, slug, suspended_at)';

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

export async function loadOwnedRestaurantIdForUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('restaurants')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data?.id as string | undefined) ?? null;
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
