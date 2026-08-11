import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { parseStaffUserMetadata } from '@/lib/staff-account';
import { loadAuthOwnershipGate } from '@/lib/staff-access';
import type { Restaurant } from '@/types';
import { reconcileRestaurantLicense } from '@/lib/license-materialize';

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
  'id' | 'name' | 'slug' | 'logo_url' | 'feature_flags' | 'license_valid_until' | 'plan' | 'pro_valid_until'
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
  | 'license_valid_until'
  | 'plan'
  | 'pro_valid_until'
> & {
  print_agent_config?: unknown;
};

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
  'id, name, slug, owner_id, logo_url, address, phone, geo_latitude, geo_longitude, order_radius_meters, plan, pro_valid_until, print_locale, country_code, feature_flags, buffet_service_mode, print_agent_config, suspended_at, suspension_reason, license_valid_until, created_at';

const STAFF_DASHBOARD_RESTAURANT_SELECT =
  'id, name, slug, logo_url, feature_flags, buffet_service_mode, print_agent_config, suspended_at, suspension_reason, license_valid_until, plan, pro_valid_until';

async function loadStaffRestaurant(
  admin: ReturnType<typeof createAdminClient>,
  restaurantId: string,
): Promise<StaffDashboardRestaurant | { error: string }> {
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

async function loadOwnerRestaurant(
  admin: ReturnType<typeof createAdminClient>,
  restaurantId: string,
): Promise<Restaurant | { error: string }> {
  const { data: restaurant, error } = await admin
    .from('restaurants')
    .select(OWNER_RESTAURANT_SELECT)
    .eq('id', restaurantId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!restaurant) {
    return { error: 'restaurant_not_found' };
  }
  return restaurant as Restaurant;
}

/** Soft-fail wrapper — dashboard chrome must still render if license sync blips. */
async function reconcileLicenseForDashboard(
  admin: ReturnType<typeof createAdminClient>,
  restaurantId: string,
) {
  try {
    return await reconcileRestaurantLicense(admin, restaurantId);
  } catch {
    return null;
  }
}

export async function loadDashboardAccess(): Promise<DashboardAccessResult> {
  const gate = await loadAuthOwnershipGate();
  if (!gate) return { mode: 'unauthenticated' };

  const { auth, ownedRestaurantId, staff } = gate;
  const { admin, user } = auth;

  if (ownedRestaurantId) {
    const ownedRestaurant = await loadOwnerRestaurant(admin, ownedRestaurantId);
    if ('error' in ownedRestaurant) {
      return { mode: 'access_error', message: ownedRestaurant.error };
    }
    const suspension = await reconcileLicenseForDashboard(admin, ownedRestaurant.id);
    return {
      mode: 'owner',
      restaurant: {
        ...ownedRestaurant,
        ...(suspension || {}),
      },
    };
  }

  if (staff && !staff.disabled_at) {
    if (!staff.role_id || staff.role === 'print_agent') {
      return { mode: 'unauthenticated' };
    }
    const staffRestaurant = await loadStaffRestaurant(admin, staff.restaurant_id);
    if ('error' in staffRestaurant) {
      return { mode: 'access_error', message: staffRestaurant.error };
    }
    const suspension = await reconcileLicenseForDashboard(admin, staffRestaurant.id);
    return {
      mode: 'staff',
      restaurant: { ...staffRestaurant, ...(suspension || {}) },
    };
  }

  const meta = parseStaffUserMetadata(user.user_metadata);
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
