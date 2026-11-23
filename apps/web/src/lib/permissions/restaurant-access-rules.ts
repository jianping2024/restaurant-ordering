/**
 * Pure rules behind the sole restaurant-scoped auth entry
 * (`restaurant-access.ts`; docs/technical/multi-store-access-plan.zh.md §6.2).
 * No I/O here — loaders hand in rows, these decide. Edge-safe (no server-only).
 */
import { isRestaurantSuspended } from '@mesa/shared';
import type { Capabilities } from '@/lib/permissions/can';
import {
  normalizeStoredPermissions,
  resolveCapabilitiesForOwner,
  resolveCapabilitiesFromRolePermissions,
  staffLandingPathFromCapabilities,
} from '@/lib/permissions/resolve';
import { restaurantCityFromAddress } from '@/lib/store-list-model';
import { staffRoleLabelForRestaurantRole } from '@/lib/permissions/restaurant-roles';
import { isRolePresetKey, type RolePresetKey } from '@/lib/permissions/role-templates';
import type { Principal } from '@/lib/permissions/types';
import type { AuthorizedRestaurantId } from '@/lib/permissions/authorized-restaurant-id';

export type RestaurantRef = {
  id: string;
  slug: string;
  suspended_at: string | null;
};

export type StaffRoleRow = {
  id: string;
  restaurant_id: string;
  name: string;
  preset_key: string | null;
  permissions: unknown;
  disabled_at: string | null;
};

/** Store embedded in a membership row: gate fields + what the store list shows. */
export type MembershipRestaurantRef = RestaurantRef & {
  name: string;
  address: string | null;
};

/** One membership row (店籍) with its store and role embedded. */
export type StaffMembershipRow = {
  id: string;
  restaurant_id: string;
  role: string;
  role_id: string | null;
  disabled_at: string | null;
  /** Store-picker favorite (UX only, never auth). */
  favorited_at: string | null;
  restaurant: MembershipRestaurantRef | null;
  role_row: StaffRoleRow | null;
};

export type ResolvedStaffRole = {
  roleId: string;
  roleName: string;
  presetKey: RolePresetKey | null;
  staffRoleLabel: string;
  capabilities: Capabilities;
};

/** Principal + capabilities for exactly one store (the one in the URL). */
export type RestaurantPrincipal = {
  principal: Principal;
  capabilities: Capabilities;
  restaurant: RestaurantRef;
};

/** `RestaurantPrincipal` admitted by the sole auth entry — carries the branded store id. */
export type AuthorizedRestaurantPrincipal = RestaurantPrincipal & {
  restaurantId: AuthorizedRestaurantId;
};

/**
 * One store the account may open (multi-store plan §6.2) with what the store list shows.
 * Admin account: `name` null (its one store never needs a list), `roleName` null.
 */
export type AuthorizedRestaurant = RestaurantRef & {
  access: 'owner' | 'staff';
  name: string | null;
  /** From the store address (empty when unknown). */
  city: string;
  roleName: string | null;
  favoritedAt: string | null;
  /** Same landing rule as login (capabilities in this store → first page). */
  landingPath: string;
};

/** Sole role → capabilities rule: missing or disabled role grants nothing. */
export function resolveStaffRoleCapabilities(
  role: StaffRoleRow | null,
  restaurantId: string,
): ResolvedStaffRole | null {
  if (!role || role.disabled_at || role.restaurant_id !== restaurantId) return null;
  const presetKey = isRolePresetKey(String(role.preset_key ?? ''))
    ? (role.preset_key as RolePresetKey)
    : null;
  return {
    roleId: role.id,
    roleName: role.name,
    presetKey,
    staffRoleLabel: staffRoleLabelForRestaurantRole({ preset_key: presetKey }),
    capabilities: resolveCapabilitiesFromRolePermissions(
      normalizeStoredPermissions(role.permissions),
    ),
  };
}

/** A membership the account may enter: enabled, human (not print_agent), live role. */
export function membershipIsEnterable(row: StaffMembershipRow): boolean {
  if (row.disabled_at || row.role === 'print_agent' || !row.role_id) return false;
  if (!row.restaurant) return false;
  return resolveStaffRoleCapabilities(row.role_row, row.restaurant_id) != null;
}

/**
 * Principal for one store. Owner (`owner_id` or on-prem shadow) of this store → `*`
 * (suspended store too: read-only with the suspension banner; writes have their own gate);
 * else this store's membership row → its role's capabilities, refused while the store
 * is suspended (plan §6.2 「员工拒绝」); else null.
 */
export function resolveRestaurantMembershipPrincipal(input: {
  userId: string;
  restaurantId: string;
  owned: RestaurantRef | null;
  membership: StaffMembershipRow | null;
}): RestaurantPrincipal | null {
  const { userId, restaurantId, owned, membership } = input;

  if (owned && owned.id === restaurantId) {
    return {
      principal: { kind: 'owner', restaurantId, userId },
      capabilities: resolveCapabilitiesForOwner(),
      restaurant: owned,
    };
  }

  if (!membership || membership.restaurant_id !== restaurantId) return null;
  if (!membershipIsEnterable(membership) || !membership.restaurant) return null;
  if (isRestaurantSuspended(membership.restaurant.suspended_at)) return null;
  const role = resolveStaffRoleCapabilities(membership.role_row, restaurantId);
  if (!role) return null;

  return {
    principal: {
      kind: 'staff',
      restaurantId,
      userId,
      staffAccountId: membership.id,
      roleId: role.roleId,
      roleName: role.roleName,
      presetKey: role.presetKey,
      staffRoleLabel: role.staffRoleLabel,
    },
    capabilities: role.capabilities,
    restaurant: membership.restaurant,
  };
}

/**
 * Stores the account may open. Admin account → its one store. Staff → every
 * enterable membership. Suspended stores stay listed (flagged by `suspended_at`)
 * but sort last so they are never the default.
 */
export function authorizedRestaurantsFromLoads(input: {
  owned: RestaurantRef | null;
  memberships: readonly StaffMembershipRow[];
}): AuthorizedRestaurant[] {
  if (input.owned) {
    const { id, slug, suspended_at } = input.owned;
    return [
      {
        id,
        slug,
        suspended_at,
        access: 'owner',
        name: null,
        city: '',
        roleName: null,
        favoritedAt: null,
        landingPath: staffLandingPathFromCapabilities(slug, resolveCapabilitiesForOwner()),
      },
    ];
  }

  const seen = new Set<string>();
  const out: AuthorizedRestaurant[] = [];
  for (const row of input.memberships) {
    if (!membershipIsEnterable(row) || !row.restaurant) continue;
    if (seen.has(row.restaurant.id)) continue;
    const role = resolveStaffRoleCapabilities(row.role_row, row.restaurant_id);
    if (!role) continue;
    seen.add(row.restaurant.id);
    const { id, slug, suspended_at, name, address } = row.restaurant;
    out.push({
      id,
      slug,
      suspended_at,
      access: 'staff',
      name,
      city: restaurantCityFromAddress(address),
      roleName: role.roleName,
      favoritedAt: row.favorited_at,
      landingPath: staffLandingPathFromCapabilities(slug, role.capabilities),
    });
  }
  return sortSuspendedLast(out);
}

/** Enterable now: the admin account always (read-only when suspended); staff only while open. */
export function restaurantIsEnterable(r: AuthorizedRestaurant): boolean {
  return r.access === 'owner' || !isRestaurantSuspended(r.suspended_at);
}

export type LandingDecision =
  | { kind: 'store'; restaurant: AuthorizedRestaurant }
  | { kind: 'select' }
  | { kind: 'none' };

/**
 * Sole "which store do I land in" rule (plan §8.1), for login, the store-less entry and
 * legacy aliases. `preferredSlug` (a store's own login page) wins when enterable; one
 * enterable store → it; several → the last store (cookie, already user-checked) when still
 * enterable, else the store picker; none enterable but some listed (suspended) → the picker
 * shows them greyed; nothing listed → none.
 */
export function pickLandingRestaurant(
  restaurants: readonly AuthorizedRestaurant[],
  options: { lastRestaurantId?: string | null; preferredSlug?: string | null } = {},
): LandingDecision {
  if (restaurants.length === 0) return { kind: 'none' };
  const enterable = restaurants.filter(restaurantIsEnterable);
  const preferred = options.preferredSlug
    ? enterable.find((r) => r.slug === options.preferredSlug)
    : undefined;
  if (preferred) return { kind: 'store', restaurant: preferred };
  if (enterable.length === 1) return { kind: 'store', restaurant: enterable[0] };
  const last = options.lastRestaurantId
    ? enterable.find((r) => r.id === options.lastRestaurantId)
    : undefined;
  if (last) return { kind: 'store', restaurant: last };
  return { kind: 'select' };
}

function sortSuspendedLast<T extends RestaurantRef>(rows: T[]): T[] {
  const rank = (r: T) => (isRestaurantSuspended(r.suspended_at) ? 1 : 0);
  return rows.sort((a, b) => rank(a) - rank(b));
}

export type StaffLoginTargetResult =
  | { ok: true; userId: string; restaurants: AuthorizedRestaurant[] }
  | { ok: false; code: 'invalid_credentials' }
  | { ok: false; code: 'restaurant_suspended'; suspension_reason: string | null };

/**
 * Login preflight decision: refuse only when nothing is enterable.
 * No enterable membership (missing / all disabled / print_agent) → invalid_credentials;
 * every enterable store suspended → restaurant_suspended (first store's reason).
 */
export function deriveStaffLoginTarget(input: {
  userId: string | null;
  restaurants: ReadonlyArray<AuthorizedRestaurant & { suspension_reason?: string | null }>;
}): StaffLoginTargetResult {
  if (!input.userId || input.restaurants.length === 0) {
    return { ok: false, code: 'invalid_credentials' };
  }
  const open = input.restaurants.filter((r) => !isRestaurantSuspended(r.suspended_at));
  if (open.length === 0) {
    return {
      ok: false,
      code: 'restaurant_suspended',
      suspension_reason: input.restaurants[0]?.suspension_reason ?? null,
    };
  }
  const restaurants = sortSuspendedLast(
    input.restaurants.map((r): AuthorizedRestaurant => {
      const out = { ...r };
      delete out.suspension_reason;
      return out;
    }),
  );
  return { ok: true, userId: input.userId, restaurants };
}

/** Normalize one `restaurant_roles` row (select `STAFF_ROLE_COLUMNS`). */
export function normalizeStaffRoleRow(raw: unknown): StaffRoleRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const ro = raw as Record<string, unknown>;
  if (typeof ro.id !== 'string' || typeof ro.restaurant_id !== 'string') return null;
  return {
    id: ro.id,
    restaurant_id: ro.restaurant_id,
    name: String(ro.name ?? ''),
    preset_key: (ro.preset_key as string | null) ?? null,
    permissions: ro.permissions,
    disabled_at: (ro.disabled_at as string | null) ?? null,
  };
}

/** Normalize one PostgREST membership row (embeds `restaurants`, `restaurant_roles`). */
export function normalizeStaffMembershipRow(raw: unknown): StaffMembershipRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.restaurant_id !== 'string') return null;
  if (typeof row.role !== 'string') return null;

  const one = (v: unknown) =>
    (Array.isArray(v) ? v[0] : v) as Record<string, unknown> | null | undefined;

  const r = one(row.restaurants);
  const restaurant: MembershipRestaurantRef | null =
    r && typeof r.id === 'string' && typeof r.slug === 'string'
      ? {
          id: r.id,
          slug: r.slug,
          suspended_at: (r.suspended_at as string | null) ?? null,
          name: typeof r.name === 'string' ? r.name : r.slug,
          address: typeof r.address === 'string' ? r.address : null,
        }
      : null;

  const role_row = normalizeStaffRoleRow(one(row.restaurant_roles));

  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    role: row.role,
    role_id: (row.role_id as string | null) ?? null,
    disabled_at: (row.disabled_at as string | null) ?? null,
    favorited_at: (row.favorited_at as string | null) ?? null,
    restaurant,
    role_row,
  };
}

export const STAFF_ROLE_COLUMNS = 'id, restaurant_id, name, preset_key, permissions, disabled_at';

export const STAFF_MEMBERSHIP_SELECT = `id, restaurant_id, role, role_id, disabled_at, favorited_at, restaurants(id, slug, suspended_at, name, address), restaurant_roles!role_id(${STAFF_ROLE_COLUMNS})`;
