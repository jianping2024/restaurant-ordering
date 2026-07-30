import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeCountryCode } from './country-code';
import { defaultRestaurantSlug } from './slug';
import type { PrintLocale } from './create-restaurant';

export type RegisterOnPremRestaurantInput = {
  name: string;
  ownerEmail: string;
  printLocale?: PrintLocale;
  countryCode?: string;
  slug?: string;
  /** Initial license end; null = unlimited. */
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
  if (input.licenseValidUntil != null && input.licenseValidUntil !== '') {
    const ms = Date.parse(input.licenseValidUntil);
    if (!Number.isFinite(ms)) return { ok: false, error: 'invalid_license_valid_until', status: 400 };
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
  const slug = (input.slug || '').trim() || defaultRestaurantSlug(name);
  const licenseValidUntil =
    input.licenseValidUntil === undefined || input.licenseValidUntil === ''
      ? null
      : input.licenseValidUntil;

  const { data: restaurantRow, error: insertError } = await admin
    .from('restaurants')
    .insert({
      name,
      slug,
      owner_id: null,
      owner_email: ownerEmail,
      print_locale: printLocale,
      country_code: countryCode,
      deployment_mode: 'on_prem',
      license_valid_until: licenseValidUntil,
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
