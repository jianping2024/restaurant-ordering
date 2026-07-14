import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  resolveOpenTableStaffAccess,
  resolveStaffAccess,
  type StaffAccessOk,
} from '@/lib/staff-access';
import type { StaffRole } from '@/lib/staff-account';

export const CHECKOUT_AUTHORIZED_STAFF_ROLES: StaffRole[] = ['cashier', 'frontdesk'];

/** Waiter + frontdesk staff; restaurant owner also passes via owner fallback. */
export const OPEN_TABLE_AUTHORIZED_STAFF_ROLES: StaffRole[] = ['waiter', 'frontdesk'];

export type StaffAuthContext = {
  restaurant_id: string;
  slug: string;
  role: StaffRole;
  user_id: string;
  as_owner: boolean;
};

export type StaffAuthLoadError = 'migration_required' | 'restaurant_not_found' | 'server_misconfigured';

export function staffAuthErrorStatus(error: StaffAuthLoadError): number {
  if (error === 'migration_required') return 503;
  if (error === 'restaurant_not_found') return 404;
  return 503;
}

function toAuthContext(access: StaffAccessOk): StaffAuthContext {
  return {
    restaurant_id: access.restaurant_id,
    slug: access.slug,
    role: access.role,
    user_id: access.user_id,
    as_owner: access.as_owner,
  };
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

async function verifyStaffAuthForSlug(
  slug: string,
  allowedRoles: StaffRole[],
): Promise<StaffAuthContext | null> {
  const access = await resolveStaffAccess(slug, allowedRoles);
  return access.status === 'ok' ? toAuthContext(access) : null;
}

/**
 * Open-table auth when restaurant is already resolved (append gate).
 * Skips redundant slug lookup; suspended check is caller's responsibility.
 */
export async function verifyOpenTableStaffAuth(
  req: Request,
  target: { slug: string; restaurantId: string },
): Promise<StaffAuthContext | null> {
  void req;
  const access = await resolveOpenTableStaffAccess(target);
  return access.status === 'ok' ? toAuthContext(access) : null;
}

/** Validates Supabase Auth session + staff account row for slug/role. */
export async function staffAuthFromRequest(
  req: Request,
  slug: string,
  role: StaffRole,
): Promise<StaffAuthContext | null> {
  void req;
  return verifyStaffAuthForSlug(slug, [role]);
}

/** Server Component / page loader — same rules as {@link staffAuthFromRequest}. */
export async function staffAuthForPage(
  slug: string,
  role: StaffRole,
): Promise<StaffAuthContext | null> {
  return verifyStaffAuthForSlug(slug, [role]);
}

/** Owner, waiter, or frontdesk — open table, waiter board/detail, transfer/merge, order edits. */
export async function openTableAuthFromRequest(
  req: Request,
  slug: string,
): Promise<StaffAuthContext | null> {
  void req;
  return verifyStaffAuthForSlug(slug, OPEN_TABLE_AUTHORIZED_STAFF_ROLES);
}

/** Owner or staff with one of the given roles for this restaurant slug. */
export async function staffAuthFromRequestWithRoles(
  req: Request,
  slug: string,
  roles: StaffRole[],
): Promise<StaffAuthContext | null> {
  void req;
  return verifyStaffAuthForSlug(slug, roles);
}
