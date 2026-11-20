import { isRestaurantSuspended } from '@mesa/shared';
import type { Capabilities } from '@/lib/permissions/can';
import {
  authorizedRestaurantsFromLoads,
  resolveStaffRoleCapabilities,
  type StaffMembershipRow,
} from '@/lib/permissions/restaurant-access-rules';

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

/**
 * Sole owner-restaurant merge: `owner_id` row wins; otherwise the on-prem
 * shadow login (`admin`) uses the claimed store. Never writes `owner_id`.
 */
export function resolveOwnerRestaurantFromLoads(input: {
  ownedByOwnerId: OwnerGateRestaurant | null;
  isOwnerShadow: boolean;
  claimedRestaurant: OwnerGateRestaurant | null;
}): OwnerGateRestaurant | null {
  if (input.ownedByOwnerId) return input.ownedByOwnerId;
  if (input.isOwnerShadow) return input.claimedRestaurant;
  return null;
}

type StaffLoginContext = {
  /** RLS / display label (preset key or `custom`) — not used for authorization. */
  roleLabel: string;
  slug: string;
  mustChangePassword: boolean;
  /** Role capabilities in the landing store — drives the landing path. */
  capabilities: Capabilities;
};

export type StaffLoginContextResult =
  | { kind: 'staff'; context: StaffLoginContext }
  | { kind: 'staff_error'; code: 'disabled' | 'incomplete' | 'restaurant_suspended' }
  | { kind: 'onboarding' };

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

/**
 * Post-login staff landing from the account's enterable stores (multi-store plan §8.1).
 * Identity = `staff_identities` row (account-level `must_change_password`); memberships =
 * every 店籍 row. Batch 1: everyone has one store, so the first enterable store is it
 * (suspended stores sort last).
 */
export function deriveStaffLoginContext(input: {
  identity: { must_change_password: boolean } | null;
  memberships: readonly StaffMembershipRow[];
  options?: { skipSuspendCheck?: boolean };
}): StaffLoginContextResult {
  const { identity, memberships } = input;

  if (memberships.length === 0) {
    return identity ? { kind: 'staff_error', code: 'incomplete' } : { kind: 'onboarding' };
  }

  const restaurants = authorizedRestaurantsFromLoads({ owned: null, memberships });
  const target = restaurants[0];
  if (!target) {
    const anyDisabled = memberships.some((m) => m.disabled_at);
    return { kind: 'staff_error', code: anyDisabled ? 'disabled' : 'incomplete' };
  }

  if (!input.options?.skipSuspendCheck && isRestaurantSuspended(target.suspended_at)) {
    return { kind: 'staff_error', code: 'restaurant_suspended' };
  }

  const membership = memberships.find((m) => m.restaurant_id === target.id);
  const role = membership ? resolveStaffRoleCapabilities(membership.role_row, target.id) : null;
  if (!membership || !role) {
    return { kind: 'staff_error', code: 'incomplete' };
  }

  return {
    kind: 'staff',
    context: {
      roleLabel: String(membership.role || 'custom'),
      slug: target.slug,
      mustChangePassword: identity?.must_change_password === true,
      capabilities: role.capabilities,
    },
  };
}
