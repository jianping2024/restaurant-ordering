import 'server-only';

import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import { createAdminClient } from '@/lib/supabase/admin';
import { can, type Capabilities } from '@/lib/permissions/can';
import type { PermissionKey } from '@/lib/permissions/registry';
import {
  loadPrincipalForRestaurant,
  type RestaurantPrincipal,
} from '@/lib/permissions/restaurant-access';
import { loadAuthUserWithAdmin } from '@/lib/staff-access';
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

function staffAuthContextFromPrincipal(
  access: RestaurantPrincipal,
  slug: string,
): StaffAuthContext {
  const { principal } = access;
  const isOwner = principal.kind === 'owner';
  return {
    restaurant_id: principal.restaurantId,
    slug,
    user_id: principal.userId,
    as_owner: isOwner,
    role_id: isOwner ? null : principal.roleId,
    role_name: isOwner ? 'owner' : principal.roleName,
    role: isOwner ? 'owner' : principal.staffRoleLabel,
    capabilities: access.capabilities,
  };
}

/**
 * Slug-route adapter (phase C: callers move to `requirePermission(key, restaurantId)`).
 * Owner (including on-prem shadow) or active staff for slug — via the sole
 * `loadPrincipalForRestaurant`. Floor/kitchen surfaces keep their suspended gate:
 * a suspended store refuses the admin account here too.
 * Callers must check `can(ctx.capabilities, permission)`.
 */
export async function staffSessionForSlug(slug: string): Promise<StaffAuthContext | null> {
  const auth = await loadAuthUserWithAdmin();
  if (!auth) return null;
  const loaded = await loadRestaurantBySlug(slug);
  if ('error' in loaded) return null;

  const access = await loadPrincipalForRestaurant(auth.user.id, loaded.restaurant.id);
  if (!access || isRestaurantSuspended(access.restaurant.suspended_at)) return null;
  return staffAuthContextFromPrincipal(access, loaded.restaurant.slug);
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

/** Table detail 开台与改人数 — sole tables.open_session. */
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
