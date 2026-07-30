import { isRestaurantSuspended } from '@mesa/shared';
import { parseStaffUserMetadata } from '@/lib/staff-account';

export type StaffLoginPreflightResult =
  | { ok: true }
  | { ok: false; code: 'invalid_credentials' | 'restaurant_suspended' };

/** Staff row + restaurant gate fields loaded in one round (embed). */
export type StaffGateAccount = {
  id: string;
  restaurant_id: string;
  role: string;
  role_id: string | null;
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
  /** RLS / display label (preset key or `custom`) — not used for authorization. */
  roleLabel: string;
  slug: string;
  mustChangePassword: boolean;
};

export type StaffLoginContextResult =
  | { kind: 'staff'; context: StaffLoginContext }
  | { kind: 'staff_error'; code: 'disabled' | 'incomplete' | 'restaurant_suspended' }
  | { kind: 'onboarding' }
  | { kind: 'incomplete_staff_meta' };

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
    role_id: (row.role_id as string | null | undefined) ?? null,
    disabled_at: (row.disabled_at as string | null | undefined) ?? null,
    restaurant,
  };
}

export function deriveStaffLoginPreflight(input: {
  account: {
    disabled_at: string | null;
    role: string;
    role_id: string | null;
    restaurant_suspended_at: string | null | undefined;
    role_disabled_at?: string | null;
  } | null;
}): StaffLoginPreflightResult {
  const { account } = input;
  if (
    !account ||
    account.disabled_at ||
    account.role_disabled_at ||
    !account.role_id ||
    account.role === 'print_agent'
  ) {
    return { ok: false, code: 'invalid_credentials' };
  }
  if (isRestaurantSuspended(account.restaurant_suspended_at)) {
    return { ok: false, code: 'restaurant_suspended' };
  }
  return { ok: true };
}

/** Derive post-login staff landing from gate rows + metadata. */
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

  if (!account.role_id || account.role === 'print_agent') {
    return { kind: 'staff_error', code: 'incomplete' };
  }

  const restaurantRow = account.restaurant;
  if (
    !input.options?.skipSuspendCheck &&
    isRestaurantSuspended(restaurantRow?.suspended_at)
  ) {
    return { kind: 'staff_error', code: 'restaurant_suspended' };
  }

  const slug = meta?.restaurant_slug ?? restaurantRow?.slug;
  if (!slug) {
    return { kind: 'staff_error', code: 'incomplete' };
  }

  return {
    kind: 'staff',
    context: {
      roleLabel: String(account.role || 'custom'),
      slug,
      mustChangePassword: meta?.must_change_password === true,
    },
  };
}
