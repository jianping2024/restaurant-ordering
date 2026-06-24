import { createClient } from '@/lib/supabase/server';
import { parseStaffUserMetadata } from '@/lib/staff-account';
import type { Restaurant } from '@/types';

export type DashboardAccessMode = 'owner' | 'cashier';

export type DashboardAccess =
  | { mode: 'owner'; restaurant: Restaurant }
  | { mode: 'cashier'; restaurant: Pick<Restaurant, 'id' | 'name' | 'slug'> };

export type DashboardAccessResult =
  | DashboardAccess
  | { mode: 'unauthenticated' }
  | { mode: 'onboarding' }
  | { mode: 'access_error'; message: string };

const OWNER_RESTAURANT_SELECT =
  'id, name, slug, owner_id, logo_url, address, phone, geo_latitude, geo_longitude, plan, print_locale, country_code, feature_flags, suspended_at, suspension_reason, created_at';

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

  const meta = parseStaffUserMetadata(user.user_metadata as Record<string, unknown>);
  if (meta?.account_type === 'staff' || (account && !account.disabled_at)) {
    return { mode: 'unauthenticated' };
  }

  return { mode: 'onboarding' };
}

export function isCashierCheckoutPath(pathname: string): boolean {
  return pathname === '/dashboard/checkout' || pathname.startsWith('/dashboard/checkout/');
}

export async function isCashierStaffUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  userMetadata: Record<string, unknown> | undefined,
): Promise<boolean> {
  const { data: account } = await supabase
    .from('restaurant_staff_accounts')
    .select('role, disabled_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (account && !account.disabled_at && account.role === 'cashier') {
    return true;
  }

  const meta = parseStaffUserMetadata(userMetadata);
  return meta?.staff_role === 'cashier';
}
