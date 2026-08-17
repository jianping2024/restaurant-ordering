import 'server-only';

import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import { createAdminClient } from '@/lib/supabase/admin';
import { can, type Capabilities } from '@/lib/permissions/can';
import {
  staffRoleLabelForRestaurantRole,
} from '@/lib/permissions/restaurant-roles';
import { isRolePresetKey } from '@/lib/permissions/role-templates';
import {
  normalizeStoredPermissions,
  resolveCapabilitiesForOwner,
  resolveCapabilitiesFromRolePermissions,
} from '@/lib/permissions/resolve';
import type { PermissionKey } from '@/lib/permissions/registry';
import { loadAuthUserWithAdmin } from '@/lib/staff-access';
import { loadOwnerRestaurantForUser } from '@/lib/staff-gate-db';
import { ownerRestaurantMatchesTarget } from '@/lib/staff-identity-gate';
import { isRestaurantSuspended } from '@mesa/shared';

export type StaffAuthContext = {
  restaurant_id: string;
  slug: string;
  user_id: string;
  as_owner: boolean;
  role_id: string | null;
  role_name: string;
  /**
   * RLS / audit label: preset key, `custom`, or `owner`.
   * Not used for authorization — use `capabilities`.
   */
  role: string;
  capabilities: Capabilities;
};

export type StaffAuthLoadError = 'migration_required' | 'restaurant_not_found' | 'server_misconfigured';

export function staffAuthErrorStatus(error: StaffAuthLoadError): number {
  if (error === 'migration_required') return 503;
  if (error === 'restaurant_not_found') return 404;
  return 503;
}

export async function loadRestaurantBySlug(slug: string) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'server_misconfigured' as const };
  }

  const { data: restaurant, error } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    if (isDbMigrationRequiredError(error)) {
      return { error: 'migration_required' as const };
    }
    return { error: 'restaurant_not_found' as const };
  }
  if (!restaurant) {
    return { error: 'restaurant_not_found' as const };
  }

  return { admin, restaurant: restaurant as { id: string; slug: string } };
}

async function loadStaffCapabilities(
  admin: ReturnType<typeof createAdminClient>,
  restaurantId: string,
  roleId: string | null,
): Promise<{
  role_id: string;
  role_name: string;
  staff_role_label: string;
  capabilities: Capabilities;
} | null> {
  if (!roleId) return null;

  const { data: role } = await admin
    .from('restaurant_roles')
    .select('id, name, preset_key, permissions, disabled_at')
    .eq('id', roleId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (!role || role.disabled_at) return null;

  const permissions = normalizeStoredPermissions(role.permissions);
  const presetKey = isRolePresetKey(String(role.preset_key ?? ''))
    ? (role.preset_key as 'kitchen' | 'waiter' | 'cashier' | 'frontdesk' | 'owner')
    : null;
  return {
    role_id: role.id as string,
    role_name: String(role.name),
    staff_role_label: staffRoleLabelForRestaurantRole({ preset_key: presetKey }),
    capabilities: resolveCapabilitiesFromRolePermissions(permissions),
  };
}

function ownerStaffAuthContext(
  userId: string,
  slug: string,
  restaurantId: string,
): StaffAuthContext {
  return {
    restaurant_id: restaurantId,
    slug,
    user_id: userId,
    as_owner: true,
    role_id: null,
    role_name: 'owner',
    role: 'owner',
    capabilities: resolveCapabilitiesForOwner(),
  };
}

/**
 * Owner (including on-prem shadow) or active staff for slug.
 * Disabled restaurant_roles → null. Callers must check `can(ctx.capabilities, permission)`.
 */
export async function staffSessionForSlug(slug: string): Promise<StaffAuthContext | null> {
  const auth = await loadAuthUserWithAdmin();
  if (!auth) return null;
  const { user, admin } = auth;

  const [owned, staffRes] = await Promise.all([
    loadOwnerRestaurantForUser(admin, {
      userId: user.id,
      email: user.email,
      userMetadata: user.user_metadata,
    }),
    admin
      .from('restaurant_staff_accounts')
      .select('id, restaurant_id, role, role_id, disabled_at, restaurants(id, slug, suspended_at)')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);
  const staffRaw = staffRes.data;

  if (ownerRestaurantMatchesTarget(owned, { slug })) {
    if (isRestaurantSuspended(owned.suspended_at)) return null;
    return ownerStaffAuthContext(user.id, slug, owned.id);
  }

  if (!staffRaw || staffRaw.disabled_at || staffRaw.role === 'print_agent') return null;
  const embedded = staffRaw.restaurants as
    | { id: string; slug: string; suspended_at: string | null }
    | { id: string; slug: string; suspended_at: string | null }[]
    | null;
  const restaurant = Array.isArray(embedded) ? embedded[0] : embedded;
  if (!restaurant || restaurant.slug !== slug) return null;
  if (isRestaurantSuspended(restaurant.suspended_at)) return null;

  const caps = await loadStaffCapabilities(
    admin,
    staffRaw.restaurant_id as string,
    (staffRaw.role_id as string | null) ?? null,
  );
  if (!caps) return null;

  return {
    restaurant_id: staffRaw.restaurant_id as string,
    slug,
    user_id: user.id,
    as_owner: false,
    role_id: caps.role_id,
    role_name: caps.role_name,
    role: caps.staff_role_label,
    capabilities: caps.capabilities,
  };
}

export async function staffSessionForRestaurant(target: {
  slug: string;
  restaurantId: string;
}): Promise<StaffAuthContext | null> {
  const ctx = await staffSessionForSlug(target.slug);
  if (!ctx || ctx.restaurant_id !== target.restaurantId) return null;
  return ctx;
}

export async function requireStaffPermission(
  slug: string,
  permission: PermissionKey,
): Promise<StaffAuthContext | null> {
  const ctx = await staffSessionForSlug(slug);
  if (!ctx) return null;
  if (!can(ctx.capabilities, permission)) return null;
  return ctx;
}

export async function requireStaffAnyPermission(
  slug: string,
  permissions: readonly PermissionKey[],
): Promise<StaffAuthContext | null> {
  const ctx = await staffSessionForSlug(slug);
  if (!ctx) return null;
  if (!permissions.some((p) => can(ctx.capabilities, p))) return null;
  return ctx;
}

export async function staffAuthFromRequest(
  _req: Request,
  slug: string,
  permission: PermissionKey,
): Promise<StaffAuthContext | null> {
  void _req;
  return requireStaffPermission(slug, permission);
}

export async function staffAuthForPage(
  slug: string,
  permission: PermissionKey,
): Promise<StaffAuthContext | null> {
  return requireStaffPermission(slug, permission);
}

/** Floor board page APIs — sole dashboard.waiter_board.view. */
export async function waiterBoardAuthFromRequest(
  _req: Request,
  slug: string,
): Promise<StaffAuthContext | null> {
  void _req;
  return requireStaffPermission(slug, 'dashboard.waiter_board.view');
}

/** Table detail 开台 / 保存人数 — sole tables.open_session. */
export async function tableSessionOpenAuthFromRequest(
  _req: Request,
  slug: string,
): Promise<StaffAuthContext | null> {
  void _req;
  return requireStaffPermission(slug, 'tables.open_session');
}

export async function verifyOpenTableStaffAuth(
  _req: Request,
  target: { slug: string; restaurantId: string },
): Promise<StaffAuthContext | null> {
  void _req;
  const ctx = await staffSessionForRestaurant(target);
  if (!ctx) return null;
  const keys: PermissionKey[] = [
    'dashboard.waiter_board.view',
    'tables.open_session',
    'orders.append',
  ];
  if (!keys.some((p) => can(ctx.capabilities, p))) return null;
  return ctx;
}

export async function checkoutStaffAuthFromRequest(
  _req: Request,
  slug: string,
): Promise<StaffAuthContext | null> {
  void _req;
  return requireStaffPermission(slug, 'checkout.confirm_payment');
}
