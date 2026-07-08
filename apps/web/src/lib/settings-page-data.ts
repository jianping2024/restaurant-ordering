import 'server-only';

import { redirect } from 'next/navigation';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import { loadBuffetDashboard, type BuffetDashboardData } from '@/lib/dashboard-buffet-server';
import {
  normalizeRestaurantFeatureFlags,
  resolvePrintAgentCredentialTtlDays,
  type ResolvedRestaurantFeatureFlags,
} from '@/lib/restaurant-features';
import { mapStaffRow } from '@/lib/staff-dashboard-api';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Restaurant, RestaurantSettingsProfile, RestaurantStaffAccount } from '@/types';
import { isDbMigrationRequiredError } from '@/lib/db-migration-error';

/** Owner-only settings pages — shares cached auth with dashboard layout. */
export async function requireOwnerRestaurant(): Promise<Restaurant> {
  const access = await getDashboardAccess();
  if (access.mode === 'unauthenticated') redirect('/auth/login');
  if (access.mode !== 'owner') redirect('/dashboard');
  return access.restaurant;
}

export function toSettingsProfile(restaurant: Restaurant): RestaurantSettingsProfile {
  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    address: restaurant.address,
    phone: restaurant.phone,
    geo_latitude: restaurant.geo_latitude,
    geo_longitude: restaurant.geo_longitude,
    order_radius_meters: restaurant.order_radius_meters,
    country_code: restaurant.country_code,
    feature_flags: restaurant.feature_flags,
  };
}

export async function loadStaffSettingsPageData(
  restaurantId: string,
): Promise<RestaurantStaffAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('restaurant_staff_accounts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data || []).map((row) => mapStaffRow(row as Record<string, unknown>));
}

export type FeatureSettingsPageData = {
  flags: ResolvedRestaurantFeatureFlags;
  credentialTtlDays: number;
  orderCooldownSeconds: number;
};

/** Loads print-agent config only; feature_flags come from cached dashboard access. */
export async function loadFeatureSettingsPageData(
  restaurantId: string,
  featureFlags: Restaurant['feature_flags'],
): Promise<FeatureSettingsPageData> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('restaurants')
    .select('print_agent_config, order_cooldown_seconds')
    .eq('id', restaurantId)
    .single();

  const isMigrationRequired = isDbMigrationRequiredError(error);
  const orderCooldownSeconds = !isMigrationRequired
    ? Number(data?.order_cooldown_seconds ?? 5)
    : 5;

  return {
    flags: normalizeRestaurantFeatureFlags(featureFlags),
    credentialTtlDays: resolvePrintAgentCredentialTtlDays(data?.print_agent_config),
    orderCooldownSeconds: Math.max(5, Math.min(60, orderCooldownSeconds)),
  };
}

/** Buffet settings — same admin-backed loader as dashboard buffet API. */
export async function loadBuffetSettingsPageData(
  restaurantId: string,
): Promise<BuffetDashboardData> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    redirect('/dashboard');
  }

  const data = await loadBuffetDashboard(admin, restaurantId);
  if ('error' in data) redirect('/dashboard');
  return data;
}
