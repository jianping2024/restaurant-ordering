import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { mintAuthorizedRestaurantId } from '@/lib/permissions/authorized-restaurant-id';
import { loadClaimedOnPremRestaurant } from '@/lib/auth/prem-builtin-admin';
import { isPremBuiltinAdminActor } from '@/lib/auth/prem-builtin-admin-identity';
import {
  STAFF_MEMBERSHIP_SELECT,
  normalizeStaffMembershipRow,
  resolveRestaurantMembershipPrincipal,
  type AuthorizedRestaurantPrincipal,
  type RestaurantRef,
  type StaffMembershipRow,
} from '@/lib/permissions/restaurant-access-rules';
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

/** Every membership row (店籍) of one account, store + role embedded — one query regardless of store count. */
export async function loadStaffMembershipsForUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<StaffMembershipRow[]> {
  const { data, error } = await admin
    .from('restaurant_staff_accounts')
    .select(STAFF_MEMBERSHIP_SELECT)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map(normalizeStaffMembershipRow)
    .filter((row): row is StaffMembershipRow => row != null);
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

/** One membership row for (store, user) with store + role embedded. Edge-safe. */
export async function loadStaffMembership(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  restaurantId: string,
): Promise<StaffMembershipRow | null> {
  const { data, error } = await admin
    .from('restaurant_staff_accounts')
    .select(STAFF_MEMBERSHIP_SELECT)
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeStaffMembershipRow(data);
}

/**
 * Sole principal-for-store loader body (multi-store plan §6.2), shared by the request-cached
 * `loadPrincipalForRestaurant` and Edge middleware. Caller hands in the account's owned store.
 * No suspension filter (batch 1 keeps current behavior): a suspended store still admits its
 * admin and staff to the dashboard (suspension banner); writes keep their own suspended gates,
 * floor/kitchen (`staffSessionForSlug`) and login preflight refuse suspended stores themselves.
 */
export async function resolvePrincipalForRestaurantWith(
  admin: ReturnType<typeof createAdminClient>,
  input: { userId: string; restaurantId: string; owned: RestaurantRef | null },
): Promise<AuthorizedRestaurantPrincipal | null> {
  const membership =
    input.owned?.id === input.restaurantId
      ? null
      : await loadStaffMembership(admin, input.userId, input.restaurantId);
  const access = resolveRestaurantMembershipPrincipal({
    userId: input.userId,
    restaurantId: input.restaurantId,
    owned: input.owned,
    membership,
  });
  if (!access) return null;
  return { ...access, restaurantId: mintAuthorizedRestaurantId(access.restaurant.id) };
}

/** Store id + slug by URL slug (null when unknown). Edge-safe. */
export async function loadRestaurantRefBySlug(
  admin: ReturnType<typeof createAdminClient>,
  slug: string,
): Promise<RestaurantRef | null> {
  const { data, error } = await admin
    .from('restaurants')
    .select('id, slug, suspended_at')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? asOwnerGateRestaurant(data) : null;
}
