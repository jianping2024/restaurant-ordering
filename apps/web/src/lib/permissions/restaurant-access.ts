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
import {
  authorizedRestaurantsFromLoads,
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
 * Stores this account may open: admin → its one store; staff → enabled, non-print_agent
 * memberships with a live role. Suspended stores are listed (flagged) and sorted last.
 */
export async function listAuthorizedRestaurantsForUser(
  userId: string,
): Promise<AuthorizedRestaurant[]> {
  const owned = await loadOwnedRestaurant(userId);
  if (owned) return authorizedRestaurantsFromLoads({ owned, memberships: [] });
  const memberships = await loadStaffMembershipsForUser(createAdminClient(), userId);
  return authorizedRestaurantsFromLoads({ owned: null, memberships });
}

/**
 * Principal for exactly this store. Admin of this store → `*`; else this store's
 * membership (enabled, role live) → role capabilities; else null.
 * Suspended store: admitted (dashboard shows the suspension banner; writes have their own gate).
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
