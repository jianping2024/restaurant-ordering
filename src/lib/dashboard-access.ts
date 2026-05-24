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
  | { mode: 'onboarding' };

export async function loadDashboardAccess(): Promise<DashboardAccessResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { mode: 'unauthenticated' };

  const { data: ownedRestaurant } = await supabase
    .from('restaurants')
    .select(
      'id, name, slug, owner_id, logo_url, address, phone, geo_latitude, geo_longitude, plan, print_locale, created_at',
    )
    .eq('owner_id', user.id)
    .maybeSingle();

  if (ownedRestaurant) {
    return { mode: 'owner', restaurant: ownedRestaurant as Restaurant };
  }

  const meta = parseStaffUserMetadata(user.user_metadata as Record<string, unknown>);
  if (meta?.staff_role === 'cashier') {
    const { data: account } = await supabase
      .from('restaurant_staff_accounts')
      .select('restaurant_id, disabled_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!account || account.disabled_at) {
      return { mode: 'unauthenticated' };
    }

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, slug')
      .eq('id', account.restaurant_id)
      .maybeSingle();

    if (restaurant) {
      return {
        mode: 'cashier',
        restaurant: restaurant as Pick<Restaurant, 'id' | 'name' | 'slug'>,
      };
    }
  }

  if (meta?.account_type === 'staff') {
    return { mode: 'unauthenticated' };
  }

  return { mode: 'onboarding' };
}

export function isCashierCheckoutPath(pathname: string): boolean {
  return pathname === '/dashboard/checkout' || pathname.startsWith('/dashboard/checkout/');
}
