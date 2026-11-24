import 'server-only';

import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOnPremInstallHost } from '@/lib/license-on-prem-host';
import { reconcileRestaurantLicense } from '@/lib/license-materialize';
import { loadAuthUserWithAdmin } from '@/lib/staff-access';
import {
  loadOwnerRestaurantForUser,
  loadStaffMembershipsForUser,
  resolvePrincipalForRestaurantWith,
} from '@/lib/staff-gate-db';
import { can } from '@/lib/permissions/can';
import {
  mintAuthorizedRestaurantId,
  type AuthorizedRestaurantId,
} from '@/lib/permissions/authorized-restaurant-id';
import type { PermissionKey } from '@/lib/permissions/registry';
import {
  authorizedRestaurantsFromLoads,
  resolveRestaurantMembershipPrincipal,
  deriveStaffLoginTarget,
  type AuthorizedRestaurant,
  type AuthorizedRestaurantPrincipal,
  type RestaurantRef,
  type StaffLoginTargetResult,
} from '@/lib/permissions/restaurant-access-rules';

export type {
  AuthorizedRestaurant,
  AuthorizedRestaurantPrincipal,
  RestaurantPrincipal,
  RestaurantRef,
  StaffLoginTargetResult,
} from '@/lib/permissions/restaurant-access-rules';

/**
 * Sole restaurant-scoped auth entry (multi-store plan §6.2).
 * The store always comes from the caller (URL slug → id); never derived from the user.
 */

type Admin = SupabaseClient;

/** Email + metadata only matter for the on-prem shadow admin; skip the lookup elsewhere. */
async function loadOwnerIdentity(
  admin: Admin,
  userId: string,
): Promise<{ email: string | null; userMetadata: Record<string, unknown> | null } | null> {
  if (!isOnPremInstallHost()) return null;
  const session = await loadAuthUserWithAdmin();
  if (session?.user.id === userId) {
    return { email: session.user.email, userMetadata: session.user.user_metadata };
  }
  const { data } = await admin.auth.admin.getUserById(userId);
  if (!data?.user) return null;
  return {
    email: data.user.email ?? null,
    userMetadata: (data.user.user_metadata as Record<string, unknown>) ?? null,
  };
}

/** Request-scoped: the one store this account administers (`owner_id` or on-prem shadow). */
const loadOwnedRestaurant = cache(async (userId: string): Promise<RestaurantRef | null> => {
  const admin = createAdminClient();
  const identity = await loadOwnerIdentity(admin, userId);
  return loadOwnerRestaurantForUser(admin, {
    userId,
    email: identity?.email,
    userMetadata: identity?.userMetadata,
  });
});

/**
 * Stores this account may open (request-cached; one query whatever the store count):
 * admin → its one store; staff → enabled, non-print_agent memberships with a live role,
 * with name / city / role / favorite for the store list. Suspended stores are listed
 * (flagged) and sorted last; staff cannot enter them (`restaurantIsEnterable`).
 */
export const listAuthorizedRestaurantsForUser = cache(
  async (userId: string): Promise<AuthorizedRestaurant[]> => {
    const owned = await loadOwnedRestaurant(userId);
    if (owned) return authorizedRestaurantsFromLoads({ owned, memberships: [] });
    return authorizedRestaurantsFromLoads({ owned: null, memberships: await loadMemberships(userId) });
  },
);

/** Request-scoped: every membership row (店籍 + store + role) — one query. */
const loadMemberships = cache((userId: string) =>
  loadStaffMembershipsForUser(createAdminClient(), userId),
);

/**
 * Batch auth (multi-store plan §6.2b): every store where this account holds `key`, from one
 * membership → role join — never a principal call per store. Same admission rule as
 * {@link loadPrincipalForRestaurant} (admin of its store → `*`, suspended store admits the
 * admin but refuses staff). Besides `resolvePrincipalForRestaurantWith`, the only producer of
 * `AuthorizedRestaurantId` (allow-listed in `check-store-id-source`). Not cached across requests.
 */
export const listAuthorizedRestaurantIdsWithPermission = cache(
  async (userId: string, key: PermissionKey): Promise<AuthorizedRestaurantId[]> => {
    const owned = await loadOwnedRestaurant(userId);
    const memberships = owned ? [] : await loadMemberships(userId);
    const candidates = owned
      ? [{ restaurantId: owned.id, membership: null }]
      : memberships.map((membership) => ({ restaurantId: membership.restaurant_id, membership }));
    const ids: AuthorizedRestaurantId[] = [];
    const seen = new Set<string>();
    for (const { restaurantId, membership } of candidates) {
      if (seen.has(restaurantId)) continue;
      const access = resolveRestaurantMembershipPrincipal({ userId, restaurantId, owned, membership });
      if (!access || !can(access.capabilities, key)) continue;
      seen.add(restaurantId);
      ids.push(mintAuthorizedRestaurantId(access.restaurant.id));
    }
    return ids;
  },
);

/**
 * Principal for exactly this store. Admin of this store → `*`; else this store's
 * membership (enabled, role live) → role capabilities; else null.
 * Suspended store: admin admitted read-only (suspension banner; writes have their own gate),
 * staff refused (plan §6.2).
 */
export const loadPrincipalForRestaurant = cache(
  async (userId: string, restaurantId: string): Promise<AuthorizedRestaurantPrincipal | null> =>
    resolvePrincipalForRestaurantWith(createAdminClient(), {
      userId,
      restaurantId,
      owned: await loadOwnedRestaurant(userId),
    }),
);

/**
 * Login preflight (before Supabase sign-in): `staff_identities.login_name` → user →
 * authorized stores (license reconciled). Refuses only when nothing is enterable.
 */
export async function resolveStaffLoginTarget(loginName: string): Promise<StaffLoginTargetResult> {
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    throw new Error('server_misconfigured');
  }

  const { data: identity, error } = await admin
    .from('staff_identities')
    .select('user_id')
    .eq('login_name', loginName)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const userId = (identity?.user_id as string | undefined) ?? null;
  if (!userId) return deriveStaffLoginTarget({ userId: null, restaurants: [] });

  const memberships = await loadStaffMembershipsForUser(admin, userId);
  const authorized = authorizedRestaurantsFromLoads({ owned: null, memberships });
  const reconciled = await Promise.all(
    authorized.map(async (r) => {
      const license = await reconcileRestaurantLicense(admin, r.id);
      return license
        ? { ...r, suspended_at: license.suspended_at, suspension_reason: license.suspension_reason }
        : { ...r, suspension_reason: null };
    }),
  );
  return deriveStaffLoginTarget({ userId, restaurants: reconciled });
}
