import 'server-only';

import { isRestaurantSuspended } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  isStaffRole,
  parseStaffUserMetadata,
  type StaffRole,
} from '@/lib/staff-account';

export type StaffAccessOk = {
  status: 'ok';
  restaurant_id: string;
  slug: string;
  role: StaffRole;
  user_id: string;
  as_owner: boolean;
};

export type StaffAccessDeniedReason =
  | 'unauthenticated'
  | 'needs_password_change'
  | 'wrong_context'
  | 'disabled'
  | 'restaurant_suspended';

export type StaffAccessResult =
  | StaffAccessOk
  | { status: 'denied'; reason: StaffAccessDeniedReason };

export type StaffLoginPreflightResult =
  | { ok: true }
  | { ok: false; code: 'invalid_credentials' | 'restaurant_suspended' };

type StaffAccountRow = {
  id: string;
  restaurant_id: string;
  role: string;
  disabled_at: string | null;
};

type RestaurantGateRow = {
  id: string;
  slug: string;
  suspended_at: string | null;
};

function denied(reason: StaffAccessDeniedReason): StaffAccessResult {
  return { status: 'denied', reason };
}

function okStaff(
  row: StaffAccountRow,
  slug: string,
  userId: string,
): StaffAccessOk | StaffAccessResult {
  if (row.disabled_at) return denied('disabled');
  if (!isStaffRole(row.role)) return denied('wrong_context');
  return {
    status: 'ok',
    restaurant_id: row.restaurant_id,
    slug,
    role: row.role,
    user_id: userId,
    as_owner: false,
  };
}

async function loadAuthUserWithAdmin(): Promise<{
  user: { id: string; user_metadata: Record<string, unknown> };
  admin: ReturnType<typeof createAdminClient>;
} | null> {
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
}

function needsPasswordChangeForSlug(
  metadata: Record<string, unknown>,
  slug: string,
  allowedRoles: StaffRole[],
): boolean {
  const meta = parseStaffUserMetadata(metadata);
  return (
    meta?.must_change_password === true &&
    meta.restaurant_slug === slug &&
    allowedRoles.includes(meta.staff_role)
  );
}

/** Authenticated staff or owner access for a restaurant slug and role set. */
export async function resolveStaffAccess(
  slug: string,
  allowedRoles: StaffRole[],
): Promise<StaffAccessResult> {
  const auth = await loadAuthUserWithAdmin();
  if (!auth) return denied('unauthenticated');
  const { user, admin } = auth;

  if (needsPasswordChangeForSlug(user.user_metadata, slug, allowedRoles)) {
    return denied('needs_password_change');
  }

  const { data: asOwner } = await admin
    .from('restaurants')
    .select('id, slug, suspended_at')
    .eq('slug', slug)
    .eq('owner_id', user.id)
    .maybeSingle();

  const ownerRow = asOwner as RestaurantGateRow | null;
  if (ownerRow) {
    if (isRestaurantSuspended(ownerRow.suspended_at)) {
      return denied('restaurant_suspended');
    }
    return {
      status: 'ok',
      restaurant_id: ownerRow.id,
      slug,
      role: allowedRoles[0],
      user_id: user.id,
      as_owner: true,
    };
  }

  const { data: account } = await admin
    .from('restaurant_staff_accounts')
    .select('id, restaurant_id, role, disabled_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const staffRow = account as StaffAccountRow | null;
  if (!staffRow) return denied('unauthenticated');
  if (!allowedRoles.includes(staffRow.role as StaffRole)) {
    return denied('wrong_context');
  }

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, slug, suspended_at')
    .eq('id', staffRow.restaurant_id)
    .maybeSingle();

  const restaurantRow = restaurant as RestaurantGateRow | null;
  if (!restaurantRow || restaurantRow.slug !== slug) {
    return denied('wrong_context');
  }
  if (isRestaurantSuspended(restaurantRow.suspended_at)) {
    return denied('restaurant_suspended');
  }

  return okStaff(staffRow, slug, user.id);
}

/** Open-table auth when restaurant is already resolved (append gate). */
export async function resolveOpenTableStaffAccess(target: {
  slug: string;
  restaurantId: string;
}): Promise<StaffAccessResult> {
  const auth = await loadAuthUserWithAdmin();
  if (!auth) return denied('unauthenticated');
  const { user, admin } = auth;

  const openRoles: StaffRole[] = ['waiter', 'frontdesk'];
  if (needsPasswordChangeForSlug(user.user_metadata, target.slug, openRoles)) {
    return denied('needs_password_change');
  }

  const { data: account } = await admin
    .from('restaurant_staff_accounts')
    .select('id, restaurant_id, role, disabled_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const staffRow = account as StaffAccountRow | null;
  if (
    staffRow &&
    !staffRow.disabled_at &&
    staffRow.restaurant_id === target.restaurantId &&
    openRoles.includes(staffRow.role as StaffRole)
  ) {
    return okStaff(staffRow, target.slug, user.id);
  }

  const { data: asOwner } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('id', target.restaurantId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!asOwner || (asOwner.slug as string) !== target.slug) {
    return denied('unauthenticated');
  }

  return {
    status: 'ok',
    restaurant_id: target.restaurantId,
    slug: target.slug,
    role: 'waiter',
    user_id: user.id,
    as_owner: true,
  };
}

/** Check staff account exists, is enabled, and restaurant is not suspended — before Supabase sign-in. */
export async function preflightStaffLogin(loginName: string): Promise<StaffLoginPreflightResult> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    throw new Error('server_misconfigured');
  }

  const { data: account } = await admin
    .from('restaurant_staff_accounts')
    .select('id, disabled_at, restaurant_id')
    .eq('login_name', loginName)
    .maybeSingle();

  if (!account || account.disabled_at) {
    return { ok: false, code: 'invalid_credentials' };
  }

  const { data: restaurantRow } = await admin
    .from('restaurants')
    .select('suspended_at')
    .eq('id', account.restaurant_id as string)
    .maybeSingle();

  if (isRestaurantSuspended(restaurantRow?.suspended_at as string | null | undefined)) {
    return { ok: false, code: 'restaurant_suspended' };
  }

  return { ok: true };
}
