import type { SupabaseClient } from '@supabase/supabase-js';
import {
  extendLicenseValidUntil,
  isLicenseExtendPeriod,
  resolveLicenseCalendarDate,
  type LicenseExtendPeriod,
} from '@mesa/shared';

type ProClockRow = {
  id: string;
  plan: string | null;
  pro_valid_until: string | null;
};

async function loadProClockRow(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<
  | { ok: true; restaurant: ProClockRow }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const { data, error } = await admin
    .from('restaurants')
    .select('id, plan, pro_valid_until')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: 'fetch_failed', status: 500, detail: error.message };
  }
  if (!data) {
    return { ok: false, error: 'not_found', status: 404 };
  }
  return { ok: true, restaurant: data };
}

async function writeRestaurantProValidUntil(
  admin: SupabaseClient,
  restaurant: ProClockRow,
  proValidUntil: string,
): Promise<
  | { ok: true; proValidUntil: string }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const { error } = await admin
    .from('restaurants')
    .update({ plan: 'pro', pro_valid_until: proValidUntil })
    .eq('id', restaurant.id);

  if (error) {
    return { ok: false, error: 'update_failed', status: 500, detail: error.message };
  }
  return { ok: true, proValidUntil };
}

/** Absolute Pro expiry: Lisbon calendar date → end-of-day ISO (same path as license). */
export async function setRestaurantProValidUntilDate(
  admin: SupabaseClient,
  restaurantId: string,
  ymd: unknown,
  now = new Date(),
): Promise<
  | { ok: true; proValidUntil: string }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const resolved = resolveLicenseCalendarDate(ymd, now);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, status: 400 };
  }
  const loaded = await loadProClockRow(admin, restaurantId);
  if (!loaded.ok) return loaded;
  return writeRestaurantProValidUntil(admin, loaded.restaurant, resolved.licenseValidUntil);
}

/** Relative Pro extend: sole calendar periods via extendLicenseValidUntil. */
export async function extendRestaurantPro(
  admin: SupabaseClient,
  restaurantId: string,
  period: LicenseExtendPeriod,
  now = new Date(),
): Promise<
  | { ok: true; proValidUntil: string }
  | { ok: false; error: string; status: number; detail?: string }
> {
  if (!isLicenseExtendPeriod(period)) {
    return { ok: false, error: 'invalid_period', status: 400 };
  }
  const loaded = await loadProClockRow(admin, restaurantId);
  if (!loaded.ok) return loaded;
  const proValidUntil = extendLicenseValidUntil(loaded.restaurant.pro_valid_until, now, period);
  return writeRestaurantProValidUntil(admin, loaded.restaurant, proValidUntil);
}
