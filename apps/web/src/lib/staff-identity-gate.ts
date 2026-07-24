import { isRestaurantSuspended } from '@mesa/shared';
import {
  isStaffRole,
  parseStaffUserMetadata,
  FLOOR_TABLE_STAFF_ROLES,
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

/** Staff row + restaurant gate fields loaded in one round (embed). */
export type StaffGateAccount = {
  id: string;
  restaurant_id: string;
  role: string;
  disabled_at: string | null;
  restaurant: {
    id: string;
    slug: string;
    suspended_at: string | null;
  } | null;
};

export type OwnerGateRestaurant = {
  id: string;
  slug: string;
  suspended_at: string | null;
};

export type StaffLoginContext = {
  role: StaffRole;
  slug: string;
  mustChangePassword: boolean;
};

export type StaffLoginContextResult =
  | { kind: 'staff'; context: StaffLoginContext }
  | { kind: 'staff_error'; code: 'disabled' | 'incomplete' | 'restaurant_suspended' }
  | { kind: 'onboarding' }
  | { kind: 'incomplete_staff_meta' };

function denied(reason: StaffAccessDeniedReason): StaffAccessResult {
  return { status: 'denied', reason };
}

function okStaff(
  row: Pick<StaffGateAccount, 'restaurant_id' | 'role' | 'disabled_at'>,
  slug: string,
  userId: string,
): StaffAccessResult {
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

export function normalizeStaffGateRow(raw: unknown): StaffGateAccount | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.restaurant_id !== 'string') return null;
  if (typeof row.role !== 'string') return null;

  const embedded = row.restaurants;
  let restaurant: StaffGateAccount['restaurant'] = null;
  if (embedded && typeof embedded === 'object' && !Array.isArray(embedded)) {
    const r = embedded as Record<string, unknown>;
    if (typeof r.id === 'string' && typeof r.slug === 'string') {
      restaurant = {
        id: r.id,
        slug: r.slug,
        suspended_at: (r.suspended_at as string | null | undefined) ?? null,
      };
    }
  }

  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    role: row.role,
    disabled_at: (row.disabled_at as string | null | undefined) ?? null,
    restaurant,
  };
}

/**
 * Slug API gate: owner wins when both match; then staff for this slug/roles.
 * Pure — unit-tested; loaders only supply rows.
 */
export function deriveStaffAccessForSlug(input: {
  userId: string;
  slug: string;
  allowedRoles: StaffRole[];
  userMetadata: Record<string, unknown>;
  owner: OwnerGateRestaurant | null;
  staff: StaffGateAccount | null;
}): StaffAccessResult {
  const { userId, slug, allowedRoles, userMetadata, owner, staff } = input;

  if (needsPasswordChangeForSlug(userMetadata, slug, allowedRoles)) {
    return denied('needs_password_change');
  }

  if (owner) {
    if (isRestaurantSuspended(owner.suspended_at)) {
      return denied('restaurant_suspended');
    }
    return {
      status: 'ok',
      restaurant_id: owner.id,
      slug,
      role: allowedRoles[0],
      user_id: userId,
      as_owner: true,
    };
  }

  if (!staff) return denied('unauthenticated');
  if (!allowedRoles.includes(staff.role as StaffRole)) {
    return denied('wrong_context');
  }

  const restaurant = staff.restaurant;
  if (!restaurant || restaurant.slug !== slug) {
    return denied('wrong_context');
  }
  if (isRestaurantSuspended(restaurant.suspended_at)) {
    return denied('restaurant_suspended');
  }

  return okStaff(staff, slug, userId);
}

/**
 * Known-restaurant open-table gate: matching floor staff first, else owner.
 * Preserves pre-unification precedence (staff before owner).
 */
export function deriveOpenTableStaffAccess(input: {
  userId: string;
  slug: string;
  restaurantId: string;
  userMetadata: Record<string, unknown>;
  owner: Pick<OwnerGateRestaurant, 'id' | 'slug'> | null;
  staff: StaffGateAccount | null;
}): StaffAccessResult {
  const { userId, slug, restaurantId, userMetadata, owner, staff } = input;
  const openRoles: StaffRole[] = [...FLOOR_TABLE_STAFF_ROLES];

  if (needsPasswordChangeForSlug(userMetadata, slug, openRoles)) {
    return denied('needs_password_change');
  }

  if (
    staff &&
    !staff.disabled_at &&
    staff.restaurant_id === restaurantId &&
    openRoles.includes(staff.role as StaffRole)
  ) {
    return okStaff(staff, slug, userId);
  }

  if (!owner || owner.slug !== slug) {
    return denied('unauthenticated');
  }

  return {
    status: 'ok',
    restaurant_id: restaurantId,
    slug,
    role: 'waiter',
    user_id: userId,
    as_owner: true,
  };
}

export function deriveStaffLoginPreflight(input: {
  account: {
    disabled_at: string | null;
    role: string;
    restaurant_suspended_at: string | null | undefined;
  } | null;
}): StaffLoginPreflightResult {
  const { account } = input;
  if (!account || account.disabled_at || !isStaffRole(String(account.role ?? ''))) {
    return { ok: false, code: 'invalid_credentials' };
  }
  if (isRestaurantSuspended(account.restaurant_suspended_at)) {
    return { ok: false, code: 'restaurant_suspended' };
  }
  return { ok: true };
}

/**
 * Derive post-login staff landing from gate rows + metadata.
 * DB role preferred; meta fills role fallback and slug override as before.
 */
export function deriveStaffLoginContext(input: {
  userMetadata: Record<string, unknown> | undefined;
  staff: StaffGateAccount | null;
  options?: { skipSuspendCheck?: boolean };
}): StaffLoginContextResult {
  const meta = parseStaffUserMetadata(input.userMetadata);
  const account = input.staff;

  if (!account) {
    return meta?.account_type === 'staff'
      ? { kind: 'incomplete_staff_meta' }
      : { kind: 'onboarding' };
  }

  if (account.disabled_at) {
    return { kind: 'staff_error', code: 'disabled' };
  }

  const restaurantRow = account.restaurant;
  if (
    !input.options?.skipSuspendCheck &&
    isRestaurantSuspended(restaurantRow?.suspended_at)
  ) {
    return { kind: 'staff_error', code: 'restaurant_suspended' };
  }

  const roleRaw = String(account.role || meta?.staff_role || '');
  if (!isStaffRole(roleRaw)) {
    return { kind: 'staff_error', code: 'incomplete' };
  }

  const slug = meta?.restaurant_slug ?? restaurantRow?.slug;
  if (!slug) {
    return { kind: 'staff_error', code: 'incomplete' };
  }

  return {
    kind: 'staff',
    context: {
      role: roleRaw,
      slug,
      mustChangePassword: meta?.must_change_password === true,
    },
  };
}
