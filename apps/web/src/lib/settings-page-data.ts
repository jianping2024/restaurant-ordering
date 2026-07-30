import 'server-only';

import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { loadBuffetDashboard, type BuffetDashboardData } from '@/lib/dashboard-buffet-server';
import {
  normalizeRestaurantFeatureFlags,
  resolvePrintAgentCredentialTtlDays,
  type ResolvedRestaurantFeatureFlags,
} from '@/lib/restaurant-features';
import { isStationSlipShowCategoryGroupEnabled } from '@/lib/print-agent-config';
import { listHumanStaffAccountsForRestaurant } from '@/lib/staff-dashboard-api';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Restaurant, RestaurantSettingsProfile, RestaurantStaffAccount } from '@/types';
import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import { requirePermission } from '@/lib/permissions/require';
import type { PermissionKey } from '@/lib/permissions/registry';
import { isRestaurantSuspended } from '@mesa/shared';

async function loadRestaurantByIdForSettings(restaurantId: string): Promise<Restaurant> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    redirect('/dashboard');
  }

  const { data, error } = await admin
    .from('restaurants')
    .select(
      'id, name, slug, owner_id, logo_url, address, phone, geo_latitude, geo_longitude, order_radius_meters, plan, print_locale, country_code, feature_flags, buffet_service_mode, suspended_at, suspension_reason, created_at',
    )
    .eq('id', restaurantId)
    .maybeSingle();

  if (error || !data) redirect('/dashboard');
  return data as Restaurant;
}

/**
 * Settings pages permission-based entry for both owner_id (backend admin) and staff roles.
 * Keeps the rest of the settings loaders unchanged by returning the restaurant row.
 */
export async function requireRestaurantForSettingsPermission(
  permission: PermissionKey,
  options?: { requireWritable?: boolean },
): Promise<Restaurant> {
  const auth = await requirePermission(permission);
  if (auth instanceof NextResponse) redirect('/dashboard');

  const restaurant = await loadRestaurantByIdForSettings(auth.principal.restaurantId);
  if (options?.requireWritable && isRestaurantSuspended(restaurant.suspended_at)) {
    redirect('/dashboard');
  }
  return restaurant;
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

/**
 * Full human staff list for settings.staff.manage pages.
 * Same listHumanStaffAccountsForRestaurant path as GET /api/dashboard/staff.
 */
export async function loadStaffSettingsPageData(
  restaurantId: string,
): Promise<RestaurantStaffAccount[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  const { staff } = await listHumanStaffAccountsForRestaurant(admin, restaurantId);
  return staff;
}

export type FeatureSettingsPageData = {
  flags: ResolvedRestaurantFeatureFlags;
  credentialTtlDays: number;
  stationSlipShowCategoryGroup: boolean;
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
    stationSlipShowCategoryGroup: isStationSlipShowCategoryGroupEnabled(data?.print_agent_config),
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
