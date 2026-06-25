import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isRestaurantSuspended } from '@mesa/shared';
import { parseStaffUserMetadata, type StaffRole } from '@/lib/staff-account';
import type { Restaurant } from '@/types';

export {
  isCashierCheckoutPath,
  isDashboardSettingsPath,
  isFrontdeskOperationalPath,
} from '@/lib/dashboard-paths';

export type DashboardAccessMode = 'owner' | 'cashier' | 'frontdesk';

export type DashboardAccess =
  | { mode: 'owner'; restaurant: Restaurant }
  | { mode: 'cashier'; restaurant: Pick<Restaurant, 'id' | 'name' | 'slug'> }
  | {
      mode: 'frontdesk';
      restaurant: Pick<
        Restaurant,
        'id' | 'name' | 'slug' | 'feature_flags' | 'suspended_at' | 'suspension_reason'
      >;
    };

export type DashboardAccessResult =
  | DashboardAccess
  | { mode: 'unauthenticated' }
  | { mode: 'onboarding' }
  | { mode: 'access_error'; message: string };

export type FrontdeskOperationalContext =
  | { admin: SupabaseClient; restaurantId: string }
  | { error: string; status: number };

const OWNER_RESTAURANT_SELECT =
  'id, name, slug, owner_id, logo_url, address, phone, geo_latitude, geo_longitude, plan, print_locale, country_code, feature_flags, suspended_at, suspension_reason, created_at';

const FRONTDESK_RESTAURANT_SELECT =
  'id, name, slug, feature_flags, suspended_at, suspension_reason';

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

  if (account && !account.disabled_at && account.role === 'cashier') {
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants_public')
      .select('id, name, slug')
      .eq('id', account.restaurant_id)
      .maybeSingle();

    if (restaurantError) {
      return { mode: 'access_error', message: restaurantError.message };
    }

    if (restaurant) {
      return {
        mode: 'cashier',
        restaurant: restaurant as Pick<Restaurant, 'id' | 'name' | 'slug'>,
      };
    }
  }

  if (account && !account.disabled_at && account.role === 'frontdesk') {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { mode: 'access_error', message: 'server_misconfigured' };
    }

    const { data: restaurant, error: restaurantError } = await admin
      .from('restaurants')
      .select(FRONTDESK_RESTAURANT_SELECT)
      .eq('id', account.restaurant_id)
      .maybeSingle();

    if (restaurantError) {
      return { mode: 'access_error', message: restaurantError.message };
    }

    if (restaurant) {
      return {
        mode: 'frontdesk',
        restaurant: restaurant as Pick<
          Restaurant,
          'id' | 'name' | 'slug' | 'feature_flags' | 'suspended_at' | 'suspension_reason'
        >,
      };
    }
  }

  const meta = parseStaffUserMetadata(user.user_metadata as Record<string, unknown>);
  if (meta?.account_type === 'staff' || (account && !account.disabled_at)) {
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

/** Server-side admin context for frontdesk operational dashboard pages and APIs. */
export async function loadFrontdeskOperationalContext(options?: {
  requireWritable?: boolean;
}): Promise<FrontdeskOperationalContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'unauthorized', status: 401 };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'server_misconfigured', status: 503 };
  }

  const { data: account, error: accountError } = await admin
    .from('restaurant_staff_accounts')
    .select('restaurant_id, disabled_at, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (accountError || !account || account.disabled_at || account.role !== 'frontdesk') {
    return { error: 'forbidden', status: 403 };
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from('restaurants')
    .select('id, suspended_at')
    .eq('id', account.restaurant_id)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    return { error: 'restaurant_not_found', status: 404 };
  }

  if (
    options?.requireWritable &&
    isRestaurantSuspended(restaurant.suspended_at as string | null)
  ) {
    return { error: 'restaurant_suspended', status: 403 };
  }

  return { admin, restaurantId: restaurant.id as string };
}
