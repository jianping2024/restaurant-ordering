import type { SupabaseClient } from '@supabase/supabase-js';
import { loadStaffIdentity } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPremBuiltinAdminActor } from '@/lib/auth/prem-builtin-admin-identity';
import { deriveStaffLoginContext } from '@/lib/staff-identity-gate';
import {
  loadOwnerRestaurantForUser,
  loadStaffMembershipsForUser,
} from '@/lib/staff-gate-db';
import {
  resolveCapabilitiesForOwner,
  staffLandingPathFromCapabilities,
} from '@/lib/permissions/resolve';

export type PostLoginRedirect =
  | { kind: 'owner'; path: string }
  | { kind: 'onboarding'; path: '/dashboard' }
  | { kind: 'staff'; path: string; mustChangePassword: boolean; slug: string; roleLabel: string }
  | { kind: 'staff_error'; code: 'disabled' | 'incomplete' | 'restaurant_suspended' | 'prem_admin_inactive' };

/** Resolve landing path after server-side sign-in (owner before staff). */
export async function resolvePostLoginRedirect(
  _supabase: SupabaseClient,
  userId: string,
  userMetadata: Record<string, unknown> | undefined,
  options?: { staffPreflightPassed?: boolean; email?: string | null },
): Promise<PostLoginRedirect> {
  // Caller still passes the request-scoped auth client for API stability; gate reads use admin
  // so owner + staff load in one parallel round without user-RLS serial hops.
  void _supabase;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    throw new Error('server_misconfigured');
  }

  const [ownedRestaurant, identity, memberships] = await Promise.all([
    loadOwnerRestaurantForUser(admin, {
      userId,
      email: options?.email,
      userMetadata,
    }),
    loadStaffIdentity(admin, userId),
    loadStaffMembershipsForUser(admin, userId),
  ]);

  if (ownedRestaurant) {
    // Same landing rule as staff + top-bar logo: capabilities → path (owner = * → waiter board).
    return {
      kind: 'owner',
      path: staffLandingPathFromCapabilities(
        ownedRestaurant.slug,
        resolveCapabilitiesForOwner(),
      ),
    };
  }

  // Prem built-in signed in before claim: no restaurant access — reject session.
  if (
    isPremBuiltinAdminActor({
      email: options?.email,
      userMetadata,
    })
  ) {
    return { kind: 'staff_error', code: 'prem_admin_inactive' };
  }

  const staffResult = deriveStaffLoginContext({
    identity,
    memberships,
    options: { skipSuspendCheck: options?.staffPreflightPassed === true },
  });

  if (staffResult.kind === 'onboarding') {
    return { kind: 'onboarding', path: '/dashboard' };
  }
  if (staffResult.kind === 'staff_error') {
    return staffResult;
  }

  const { roleLabel, slug, mustChangePassword, capabilities } = staffResult.context;

  return {
    kind: 'staff',
    path: staffLandingPathFromCapabilities(slug, capabilities),
    mustChangePassword,
    slug,
    roleLabel,
  };
}
