import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseBuffetServiceMode,
  type BuffetServiceMode,
} from './buffet-service-mode';
import { normalizeCountryCode } from './country-code';
import {
  isLicenseCalendarDate,
  resolveLicenseCalendarDate,
  todayLisbonCalendarDate,
} from './license-calendar';
import { proTrialValidUntil } from './premium-tier';
import { defaultRestaurantSlug } from './slug';
import type { PrintLocale } from './create-restaurant';

export type RegisterOnPremRestaurantInput = {
  name: string;
  ownerEmail: string;
  /** Required — platform chooses classic vs sushi at create time. */
  buffetServiceMode: BuffetServiceMode;
  printLocale?: PrintLocale;
  countryCode?: string;
  slug?: string;
  /** Lisbon calendar day `YYYY-MM-DD`; null/omit = unlimited. Stored as that day's Lisbon EOD. */
  licenseValidUntil?: string | null;
};

export type RegisterOnPremRestaurantSuccess = {
  ok: true;
  slug: string;
  restaurantId: string;
};

export type RegisterOnPremRestaurantFailure = {
  ok: false;
  error: string;
  status: number;
  detail?: string;
};

export type RegisterOnPremRestaurantResult =
  | RegisterOnPremRestaurantSuccess
  | RegisterOnPremRestaurantFailure;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterOnPremRestaurantInput(
  input: RegisterOnPremRestaurantInput,
): RegisterOnPremRestaurantFailure | null {
  const name = (input.name || '').trim();
  const mail = (input.ownerEmail || '').trim().toLowerCase();
  if (!name) return { ok: false, error: 'restaurant_name_required', status: 400 };
  if (!mail || !EMAIL_RE.test(mail)) return { ok: false, error: 'invalid_email', status: 400 };
  const locale = input.printLocale ?? 'pt';
  if (!['zh', 'en', 'pt'].includes(locale)) {
    return { ok: false, error: 'invalid_print_locale', status: 400 };
  }
  const countryCode = normalizeCountryCode(input.countryCode ?? 'PT');
  if (!countryCode) return { ok: false, error: 'invalid_country_code', status: 400 };
  if (!parseBuffetServiceMode(input.buffetServiceMode)) {
    return { ok: false, error: 'invalid_buffet_service_mode', status: 400 };
  }
  if (input.licenseValidUntil != null && input.licenseValidUntil !== '') {
    if (!isLicenseCalendarDate(input.licenseValidUntil)) {
      return { ok: false, error: 'invalid_license_date', status: 400 };
    }
    if (input.licenseValidUntil < todayLisbonCalendarDate()) {
      return { ok: false, error: 'license_date_before_today', status: 400 };
    }
  }
  return null;
}

/**
 * Platform control-plane registry only — does not create cloud Auth owner
 * or seed local business staff. Claim does that on the on-prem instance.
 */
export async function registerOnPremRestaurant(
  admin: SupabaseClient,
  input: RegisterOnPremRestaurantInput,
): Promise<RegisterOnPremRestaurantResult> {
  const validation = validateRegisterOnPremRestaurantInput(input);
  if (validation) return validation;

  const name = input.name.trim();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const printLocale = input.printLocale ?? 'pt';
  const countryCode = normalizeCountryCode(input.countryCode ?? 'PT')!;
  const buffetServiceMode = parseBuffetServiceMode(input.buffetServiceMode)!;
  const slug = (input.slug || '').trim() || defaultRestaurantSlug(name);
  let licenseValidUntil: string | null = null;
  if (input.licenseValidUntil != null && input.licenseValidUntil !== '') {
    const resolved = resolveLicenseCalendarDate(input.licenseValidUntil);
    if (!resolved.ok) {
      return { ok: false, error: resolved.error, status: 400 };
    }
    licenseValidUntil = resolved.licenseValidUntil;
  }

  const proValidUntil = proTrialValidUntil();

  const { data: restaurantRow, error: insertError } = await admin
    .from('restaurants')
    .insert({
      name,
      slug,
      owner_id: null,
      owner_email: ownerEmail,
      print_locale: printLocale,
      country_code: countryCode,
      buffet_service_mode: buffetServiceMode,
      deployment_mode: 'on_prem',
      license_valid_until: licenseValidUntil,
      plan: 'pro',
      pro_valid_until: proValidUntil,
    })
    .select('id')
    .single();

  if (insertError || !restaurantRow) {
    const msg = insertError?.message || '';
    if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) {
      return { ok: false, error: 'slug_exists', status: 409, detail: msg };
    }
    return {
      ok: false,
      error: 'restaurant_insert_failed',
      status: 500,
      detail: msg,
    };
  }

  return {
    ok: true,
    slug,
    restaurantId: restaurantRow.id as string,
  };
}
