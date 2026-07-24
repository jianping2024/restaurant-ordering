import 'server-only';

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { StaffRole } from '@/lib/staff-account';
import {
  deriveOpenTableStaffAccess,
  deriveStaffAccessForSlug,
  deriveStaffLoginPreflight,
  type StaffAccessResult,
  type StaffLoginPreflightResult,
} from '@/lib/staff-identity-gate';
import {
  loadOwnerForRestaurantId,
  loadOwnerForSlug,
  loadStaffGateByUserId,
} from '@/lib/staff-gate-db';

export type {
  StaffAccessOk,
  StaffAccessDeniedReason,
  StaffAccessResult,
  StaffLoginPreflightResult,
  StaffGateAccount,
  OwnerGateRestaurant,
} from '@/lib/staff-identity-gate';

export {
  deriveStaffAccessForSlug,
  deriveOpenTableStaffAccess,
  deriveStaffLoginPreflight,
  deriveStaffLoginContext,
} from '@/lib/staff-identity-gate';

function deniedUnauthenticated(): StaffAccessResult {
  return { status: 'denied', reason: 'unauthenticated' };
}

/**
 * Request-scoped getUser + admin for Node route handlers / RSC.
 * Not imported by Edge middleware (react.cache is unavailable there).
 */
export const loadAuthUserWithAdmin = cache(async (): Promise<{
  user: { id: string; user_metadata: Record<string, unknown> };
  admin: ReturnType<typeof createAdminClient>;
} | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    return {
      user: {
        id: user.id,
        user_metadata: (user.user_metadata as Record<string, unknown>) ?? {},
      },
      admin: createAdminClient(),
    };
  } catch {
    return null;
  }
});

/** Authenticated staff or owner access for a restaurant slug and role set. */
export async function resolveStaffAccess(
  slug: string,
  allowedRoles: StaffRole[],
): Promise<StaffAccessResult> {
  const auth = await loadAuthUserWithAdmin();
  if (!auth) return deniedUnauthenticated();
  const { user, admin } = auth;

  const [owner, staff] = await Promise.all([
    loadOwnerForSlug(admin, user.id, slug),
    loadStaffGateByUserId(admin, user.id),
  ]);

  return deriveStaffAccessForSlug({
    userId: user.id,
    slug,
    allowedRoles,
    userMetadata: user.user_metadata,
    owner,
    staff,
  });
}

/** Open-table auth when restaurant is already resolved (append gate). */
export async function resolveOpenTableStaffAccess(target: {
  slug: string;
  restaurantId: string;
}): Promise<StaffAccessResult> {
  const auth = await loadAuthUserWithAdmin();
  if (!auth) return deniedUnauthenticated();
  const { user, admin } = auth;

  const [staff, owner] = await Promise.all([
    loadStaffGateByUserId(admin, user.id),
    loadOwnerForRestaurantId(admin, user.id, target.restaurantId),
  ]);

  return deriveOpenTableStaffAccess({
    userId: user.id,
    slug: target.slug,
    restaurantId: target.restaurantId,
    userMetadata: user.user_metadata,
    owner,
    staff,
  });
}

/** Check staff account exists, is enabled, and restaurant is not suspended — before Supabase sign-in. */
export async function preflightStaffLogin(loginName: string): Promise<StaffLoginPreflightResult> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    throw new Error('server_misconfigured');
  }

  const { data, error } = await admin
    .from('restaurant_staff_accounts')
    .select('id, disabled_at, role, restaurants(suspended_at)')
    .eq('login_name', loginName)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return deriveStaffLoginPreflight({ account: null });
  }

  const embedded = (data as { restaurants?: { suspended_at?: string | null } | null }).restaurants;
  return deriveStaffLoginPreflight({
    account: {
      disabled_at: (data.disabled_at as string | null) ?? null,
      role: String(data.role ?? ''),
      restaurant_suspended_at: embedded?.suspended_at,
    },
  });
}
