import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { parseStaffUserMetadata } from '@/lib/staff-account';
import type { Restaurant } from '@/types';

import {
  dashboardMiddlewareRedirectPath,
  isCashierCheckoutPath,
  isDashboardSettingsPath,
  isFrontdeskOperationalPath,
  isOwnerDashboardPath,
  isOwnerOperationalPath,
} from '@/lib/dashboard-paths';

export {
  dashboardMiddlewareRedirectPath,
  isCashierCheckoutPath,
  isDashboardSettingsPath,
  isFrontdeskOperationalPath,
  isOwnerDashboardPath,
  isOwnerOperationalPath,
};

export type DashboardNavRestaurant = Pick<
  Restaurant,
  'id' | 'name' | 'slug' | 'logo_url' | 'feature_flags'
>;

export type StaffDashboardRestaurant = Pick<
  Restaurant,
  | 'id'
  | 'name'
  | 'slug'
  | 'logo_url'
  | 'feature_flags'
  | 'buffet_service_mode'
  | 'suspended_at'
  | 'suspension_reason'
>;

/** Top-bar / layout chrome only — not used for route authorization. */
export type DashboardShellMode = 'owner' | 'staff';

export type DashboardAccess =
  | { mode: 'owner'; restaurant: Restaurant }
  | { mode: 'staff'; restaurant: StaffDashboardRestaurant };

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

const STAFF_DASHBOARD_RESTAURANT_SELECT =
  'id, name, slug, logo_url, feature_flags, buffet_service_mode, suspended_at, suspension_reason';

async function loadStaffRestaurant(
  restaurantId: string,
): Promise<StaffDashboardRestaurant | { error: string }> {
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

  return restaurant as StaffDashboardRestaurant;
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
    .select('restaurant_id, disabled_at, role_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (staffError) {
    return { mode: 'access_error', message: staffError.message };
  }

  if (account && !account.disabled_at) {
    if (!account.role_id || account.role === 'print_agent') {
      return { mode: 'unauthenticated' };
    }
    const staffRestaurant = await loadStaffRestaurant(account.restaurant_id as string);
    if ('error' in staffRestaurant) {
      return { mode: 'access_error', message: staffRestaurant.error };
    }
    return { mode: 'staff', restaurant: staffRestaurant };
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
