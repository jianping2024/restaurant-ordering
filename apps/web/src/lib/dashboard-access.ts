import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { parseStaffUserMetadata, type StaffRole } from '@/lib/staff-account';
import type { Restaurant } from '@/types';

import {
  dashboardMiddlewareRedirectPath,
  isCashierCheckoutPath,
  isDashboardSettingsPath,
  isFrontdeskOperationalPath,
  isOwnerDashboardPath,
  isOwnerOperationalPath,
  type DashboardActor,
} from '@/lib/dashboard-paths';

export {
  dashboardMiddlewareRedirectPath,
  isCashierCheckoutPath,
  isDashboardSettingsPath,
  isFrontdeskOperationalPath,
  isOwnerDashboardPath,
  isOwnerOperationalPath,
  type DashboardActor,
};

/** Single-pass dashboard actor for middleware (owner + staff row in parallel). */
export async function resolveDashboardActor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  userMetadata: Record<string, unknown> | undefined,
): Promise<DashboardActor> {
  const [{ data: owner }, { data: account }] = await Promise.all([
    supabase.from('restaurants').select('id').eq('owner_id', userId).maybeSingle(),
    supabase
      .from('restaurant_staff_accounts')
      .select('role, disabled_at')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (owner) return 'owner';

  if (account && !account.disabled_at) {
    if (account.role === 'frontdesk') return 'frontdesk';
    if (account.role === 'owner') return 'store_owner';
    if (account.role === 'cashier') return 'cashier';
    if (account.role === 'waiter') return 'waiter';
    if (account.role === 'custom') return 'frontdesk'; // path shell; capabilities enforce pages
  }

  const meta = parseStaffUserMetadata(userMetadata);
  if (meta?.staff_role === 'frontdesk') return 'frontdesk';
  if (meta?.staff_role === 'owner') return 'store_owner';
  if (meta?.staff_role === 'cashier') return 'cashier';
  if (meta?.staff_role === 'waiter') return 'waiter';

  return 'unknown';
}

export type DashboardNavRestaurant = Pick<
  Restaurant,
  'id' | 'name' | 'slug' | 'logo_url' | 'feature_flags'
>;

export type FrontdeskDashboardRestaurant = Pick<
  Restaurant,
  | 'id'
  | 'name'
  | 'slug'
  | 'logo_url'
  | 'feature_flags'
  | 'suspended_at'
  | 'suspension_reason'
  | 'buffet_service_mode'
>;

/** Staff dashboard shell restaurant (nav + floor embed). */
export type StaffDashboardRestaurant = Pick<
  Restaurant,
  'id' | 'name' | 'slug' | 'logo_url' | 'feature_flags' | 'buffet_service_mode'
>;

export type DashboardAccessMode =
  | 'owner'
  | 'store_owner'
  | 'cashier'
  | 'frontdesk'
  | 'waiter'
  | 'kitchen';

function staffDashboardAccessMode(role: string): DashboardAccessMode | null {
  if (role === 'frontdesk') return 'frontdesk';
  if (role === 'owner') return 'store_owner';
  if (role === 'cashier') return 'cashier';
  if (role === 'waiter') return 'waiter';
  if (role === 'kitchen') return 'kitchen';
  if (role === 'custom') return 'frontdesk';
  return null;
}

const STAFF_DASHBOARD_RESTAURANT_SELECT =
  'id, name, slug, logo_url, feature_flags, buffet_service_mode, suspended_at, suspension_reason';

export type DashboardAccess =
  | { mode: 'owner'; restaurant: Restaurant }
  | { mode: 'store_owner'; restaurant: FrontdeskDashboardRestaurant }
  | { mode: 'cashier'; restaurant: StaffDashboardRestaurant }
  | { mode: 'waiter'; restaurant: StaffDashboardRestaurant }
  | { mode: 'frontdesk'; restaurant: FrontdeskDashboardRestaurant }
  | { mode: 'kitchen'; restaurant: StaffDashboardRestaurant };

export type DashboardAccessResult =
  | DashboardAccess
  | { mode: 'unauthenticated' }
  | { mode: 'onboarding' }
  | { mode: 'access_error'; message: string };

export type DashboardOperationalContext =
  | { admin: SupabaseClient; restaurantId: string }
  | { error: string; status: number };

const OWNER_RESTAURANT_SELECT =
  'id, name, slug, owner_id, logo_url, address, phone, geo_latitude, geo_longitude, order_radius_meters, plan, print_locale, country_code, feature_flags, buffet_service_mode, suspended_at, suspension_reason, created_at';

async function loadStaffDashboardAccess(
  restaurantId: string,
  role: string,
): Promise<DashboardAccess | { error: string }> {
  const mode = staffDashboardAccessMode(role);
  if (!mode) return { error: 'unsupported_staff_role' };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'server_misconfigured' };
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from('restaurants')
    .select(STAFF_DASHBOARD_RESTAURANT_SELECT)
    .eq('id', restaurantId)
    .maybeSingle();

  if (restaurantError) {
    return { error: restaurantError.message };
  }
  if (!restaurant) {
    return { error: 'restaurant_not_found' };
  }

  if (mode === 'frontdesk' || mode === 'store_owner') {
    return {
      mode,
      restaurant: restaurant as FrontdeskDashboardRestaurant,
    };
  }

  return {
    mode: mode as 'cashier' | 'waiter' | 'kitchen',
    restaurant: restaurant as StaffDashboardRestaurant,
  };
}

async function isActiveStaffRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  userMetadata: Record<string, unknown> | undefined,
  role: StaffRole,
): Promise<boolean> {
  const { data: account } = await supabase
    .from('restaurant_staff_accounts')
    .select('role, disabled_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (account && !account.disabled_at && account.role === role) {
    return true;
  }

  const meta = parseStaffUserMetadata(userMetadata);
  return meta?.staff_role === role;
}

export async function loadDashboardAccess(): Promise<DashboardAccessResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { mode: 'unauthenticated' };

  const { data: ownedRestaurant, error: ownerError } = await supabase
    .from('restaurants')
    .select(OWNER_RESTAURANT_SELECT)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (ownerError) {
    return { mode: 'access_error', message: ownerError.message };
  }

  if (ownedRestaurant) {
    return { mode: 'owner', restaurant: ownedRestaurant as Restaurant };
  }

  const { data: account, error: staffError } = await supabase
    .from('restaurant_staff_accounts')
    .select('restaurant_id, disabled_at, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (staffError) {
    return { mode: 'access_error', message: staffError.message };
  }

  if (account && !account.disabled_at) {
    const staffAccess = await loadStaffDashboardAccess(
      account.restaurant_id as string,
      String(account.role),
    );
    if ('error' in staffAccess) {
      if (staffAccess.error === 'unsupported_staff_role') {
        const meta = parseStaffUserMetadata(user.user_metadata as Record<string, unknown>);
        if (meta?.account_type === 'staff' || account) {
          return { mode: 'unauthenticated' };
        }
      } else {
        return { mode: 'access_error', message: staffAccess.error };
      }
    } else {
      return staffAccess;
    }
  }

  const meta = parseStaffUserMetadata(user.user_metadata as Record<string, unknown>);
  if (meta?.account_type === 'staff') {
    return { mode: 'unauthenticated' };
  }

  return { mode: 'onboarding' };
}

export async function isOwnerDashboardUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle();
  return !!restaurant;
}

export async function isCashierStaffUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  userMetadata: Record<string, unknown> | undefined,
): Promise<boolean> {
  return isActiveStaffRole(supabase, userId, userMetadata, 'cashier');
}

export async function isFrontdeskStaffUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  userMetadata: Record<string, unknown> | undefined,
): Promise<boolean> {
  return isActiveStaffRole(supabase, userId, userMetadata, 'frontdesk');
}
