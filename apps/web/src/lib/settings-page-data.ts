import { resolveTakeawayVatRate } from '@/lib/checkout-takeaway';
import 'server-only';

import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { loadBuffetDashboard, type BuffetDashboardData } from '@/lib/dashboard-buffet-server';
import {
  normalizeRestaurantFeatureFlags,
  resolvePrintAgentCredentialTtlDays,
  type ResolvedRestaurantFeatureFlags,
} from '@/lib/restaurant-features';
import {
  isStationSlipShowCategoryGroupEnabled,
  hanBitmapFontPxFromConfig,
  kitchenReadyAfterMinutesFromConfig,
} from '@/lib/print-agent-config';
import { normalizePrintLocale, type PrintLocale } from '@/lib/i18n';
import { clampOrderCooldownSeconds } from '@/lib/order-submit-cooldown-client';
import { listHumanStaffAccountsForRestaurant } from '@/lib/staff-dashboard-api';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Restaurant, RestaurantSettingsProfile, RestaurantStaffAccount } from '@/types';
import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import { requirePermission } from '@/lib/permissions/require';
import type { PermissionKey } from '@/lib/permissions/registry';
import { isRestaurantSuspended } from '@mesa/shared';
import { resolveOperationLogRetentionDays } from '@/lib/operation-logs/retention-days';
import {
  parseSushiRoundSettingsFromRestaurantRow,
  sushiRoundSettingsToApiJson,
} from '@/lib/table-order-round/settings';

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
      'id, name, slug, owner_id, logo_url, cover_url, address, phone, geo_latitude, geo_longitude, order_radius_meters, plan, pro_valid_until, license_valid_until, print_locale, country_code, feature_flags, buffet_service_mode, business_hours, storefront_intro, suspended_at, suspension_reason, created_at',
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
    logo_url: restaurant.logo_url,
    cover_url: restaurant.cover_url,
    address: restaurant.address,
    phone: restaurant.phone,
    geo_latitude: restaurant.geo_latitude,
    geo_longitude: restaurant.geo_longitude,
    order_radius_meters: restaurant.order_radius_meters,
    country_code: restaurant.country_code,
    feature_flags: restaurant.feature_flags,
    business_hours: restaurant.business_hours,
    storefront_intro: restaurant.storefront_intro,
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
  orderCooldownSeconds: number;
  operationLogRetentionDays: number;
  kitchenReadyAfterMinutes: number;
  takeawayVatRate: number;
  sushiRoundOrderingEnabled: boolean;
  sushiPerPersonPerRoundCap: number;
  sushiRoundConfirmTimeoutSeconds: number;
  sushiRoundCooldownSeconds: number;
  sushiMenuVegetarianFilterEnabled: boolean;
  sushiMenuAllergenFilterEnabled: boolean;
};

export type PrintSettingsPageData = {
  flags: ResolvedRestaurantFeatureFlags;
  credentialTtlDays: number;
  stationSlipShowCategoryGroup: boolean;
  hanBitmapFontPx: number;
  printLocale: PrintLocale;
};

/** Paper / billing-print options for「打印设置」page. */
export async function loadPrintSettingsPageData(
  restaurantId: string,
  featureFlags: Restaurant['feature_flags'],
  printLocale: Restaurant['print_locale'],
): Promise<PrintSettingsPageData> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('restaurants')
    .select('print_agent_config')
    .eq('id', restaurantId)
    .single();

  const config = isDbMigrationRequiredError(error) ? undefined : data?.print_agent_config;
  return {
    flags: normalizeRestaurantFeatureFlags(featureFlags),
    credentialTtlDays: resolvePrintAgentCredentialTtlDays(config),
    stationSlipShowCategoryGroup: isStationSlipShowCategoryGroupEnabled(config),
    hanBitmapFontPx: hanBitmapFontPxFromConfig(config),
    printLocale: normalizePrintLocale(printLocale),
  };
}

/** Feature-management page load (kitchen/flavor/cooldown/sushi/logs — not billing/print paper). */
export async function loadFeatureSettingsPageData(
  restaurantId: string,
  featureFlags: Restaurant['feature_flags'],
): Promise<FeatureSettingsPageData> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('restaurants')
    .select(
      'print_agent_config, order_cooldown_seconds, operation_log_retention_days, takeaway_vat_rate, sushi_round_ordering_enabled, sushi_per_person_per_round_cap, sushi_round_confirm_timeout_seconds, sushi_round_cooldown_seconds, sushi_menu_vegetarian_filter_enabled, sushi_menu_allergen_filter_enabled',
    )
    .eq('id', restaurantId)
    .single();

  const isMigrationRequired = isDbMigrationRequiredError(error);
  const orderCooldownSeconds = !isMigrationRequired
    ? Number(data?.order_cooldown_seconds ?? 5)
    : 5;
  const operationLogRetentionDays = !isMigrationRequired
    ? resolveOperationLogRetentionDays(data?.operation_log_retention_days)
    : resolveOperationLogRetentionDays(undefined);
  const sushiRound = parseSushiRoundSettingsFromRestaurantRow(
    isMigrationRequired ? undefined : (data ?? undefined),
  );
  const sushiApi = sushiRoundSettingsToApiJson(sushiRound);

  return {
    flags: normalizeRestaurantFeatureFlags(featureFlags),
    orderCooldownSeconds: clampOrderCooldownSeconds(orderCooldownSeconds),
    operationLogRetentionDays,
    kitchenReadyAfterMinutes: kitchenReadyAfterMinutesFromConfig(data?.print_agent_config),
    takeawayVatRate: resolveTakeawayVatRate(isMigrationRequired ? undefined : data?.takeaway_vat_rate),
    sushiRoundOrderingEnabled: sushiApi.sushiRoundOrderingEnabled,
    sushiPerPersonPerRoundCap: sushiApi.sushiPerPersonPerRoundCap,
    sushiRoundConfirmTimeoutSeconds: sushiApi.sushiRoundConfirmTimeoutSeconds,
    sushiRoundCooldownSeconds: sushiApi.sushiRoundCooldownSeconds,
    sushiMenuVegetarianFilterEnabled: sushiApi.sushiMenuVegetarianFilterEnabled,
    sushiMenuAllergenFilterEnabled: sushiApi.sushiMenuAllergenFilterEnabled,
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
