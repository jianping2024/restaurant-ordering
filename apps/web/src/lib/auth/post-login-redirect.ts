import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { staffRolePath } from '@/lib/staff-routes';
import type { StaffRole } from '@/lib/staff-account';
import { deriveStaffLoginContext } from '@/lib/staff-identity-gate';
import {
  loadOwnedRestaurantIdForUser,
  loadStaffGateAccountForUser,
} from '@/lib/staff-gate-db';

export type PostLoginRedirect =
  | { kind: 'owner'; path: '/dashboard/settings' }
  | { kind: 'onboarding'; path: '/dashboard' }
  | { kind: 'staff'; path: string; mustChangePassword: boolean; slug: string; role: StaffRole }
  | { kind: 'staff_error'; code: 'disabled' | 'incomplete' | 'restaurant_suspended' };

export { deriveStaffLoginContext } from '@/lib/staff-identity-gate';

/** Resolve landing path after server-side sign-in (owner before staff). */
export async function resolvePostLoginRedirect(
  _supabase: SupabaseClient,
  userId: string,
  userMetadata: Record<string, unknown> | undefined,
  options?: { staffPreflightPassed?: boolean },
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

  const [ownedRestaurantId, staff] = await Promise.all([
    loadOwnedRestaurantIdForUser(admin, userId),
    loadStaffGateAccountForUser(admin, userId),
  ]);

  if (ownedRestaurantId) {
    return { kind: 'owner', path: '/dashboard/settings' };
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

  const { role, slug, mustChangePassword } = staffResult.context;

  return {
    kind: 'staff',
    path: staffRolePath(slug, role),
    mustChangePassword,
    slug,
    role,
  };
}
