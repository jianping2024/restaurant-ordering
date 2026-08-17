import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPremBuiltinAdminActor } from '@/lib/auth/prem-builtin-admin-identity';
import { deriveStaffLoginContext } from '@/lib/staff-identity-gate';
import {
  loadOwnerRestaurantForUser,
  loadStaffGateAccountForUser,
} from '@/lib/staff-gate-db';
import { resolveStaffLandingPath } from '@/lib/permissions/staff-landing';

export type PostLoginRedirect =
  | { kind: 'owner'; path: '/dashboard/settings' }
  | { kind: 'onboarding'; path: '/dashboard' }
  | { kind: 'staff'; path: string; mustChangePassword: boolean; slug: string; roleLabel: string }
  | { kind: 'staff_error'; code: 'disabled' | 'incomplete' | 'restaurant_suspended' | 'prem_admin_inactive' };

export { deriveStaffLoginContext } from '@/lib/staff-identity-gate';

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

  const [ownedRestaurant, staff] = await Promise.all([
    loadOwnerRestaurantForUser(admin, {
      userId,
      email: options?.email,
      userMetadata,
    }),
    loadStaffGateAccountForUser(admin, userId),
  ]);

  if (ownedRestaurant) {
    return { kind: 'owner', path: '/dashboard/settings' };
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
    userMetadata,
    staff,
    options: { skipSuspendCheck: options?.staffPreflightPassed === true },
  });

  if (staffResult.kind === 'onboarding') {
    return { kind: 'onboarding', path: '/dashboard' };
  }
  if (staffResult.kind === 'incomplete_staff_meta') {
    return { kind: 'staff_error', code: 'incomplete' };
  }
  if (staffResult.kind === 'staff_error') {
    return staffResult;
  }

  const { roleLabel, slug, mustChangePassword } = staffResult.context;

  const path =
    staff != null
      ? await resolveStaffLandingPath(admin, staff, slug)
      : '/auth/login';

  return {
    kind: 'staff',
    path,
    mustChangePassword,
    slug,
    roleLabel,
  };
}
