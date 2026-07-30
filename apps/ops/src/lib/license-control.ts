import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SUSPENSION_REASON_LICENSE_CLOCK_REGRESSED,
  SUSPENSION_REASON_LICENSE_EXPIRED,
  SUSPENSION_REASON_LICENSE_LEASE_INVALID,
  SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED,
  buildLicenseLeaseClaims,
  extendLicenseValidUntil,
  hashLicenseSecret,
  isRestaurantSuspended,
  mintCheckinSecret,
  mintInstallCode,
  resolveLicenseCalendarDate,
  signLicenseLease,
  type LicenseExtendPeriod,
} from '@mesa/shared';

const INSTALL_CODE_TTL_MS = 24 * 60 * 60 * 1000;

const LICENSE_MATERIALIZE_REASONS = new Set([
  SUSPENSION_REASON_LICENSE_EXPIRED,
  SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED,
  SUSPENSION_REASON_LICENSE_CLOCK_REGRESSED,
  SUSPENSION_REASON_LICENSE_LEASE_INVALID,
]);

/** Ops force suspend — not a local license materialize reason. */
export function isOpsForceSuspended(
  suspendedAt: string | null | undefined,
  suspensionReason: string | null | undefined,
): boolean {
  if (!isRestaurantSuspended(suspendedAt)) return false;
  if (suspensionReason && LICENSE_MATERIALIZE_REASONS.has(suspensionReason)) return false;
  return true;
}

export function resolveLicenseLeaseSecret(): string | null {
  const secret = process.env.MESA_LICENSE_LEASE_SECRET?.trim();
  return secret || null;
}

export async function setRestaurantSuspended(
  admin: SupabaseClient,
  restaurantId: string,
  input: { suspend: boolean; reason?: string | null },
): Promise<{ ok: true; suspendedAt: string | null } | { ok: false; error: string; status: number; detail?: string }> {
  const { data: restaurant, error: fetchError } = await admin
    .from('restaurants')
    .select('id, suspended_at')
    .eq('id', restaurantId)
    .maybeSingle();

  if (fetchError) return { ok: false, error: 'fetch_failed', status: 500, detail: fetchError.message };
  if (!restaurant) return { ok: false, error: 'not_found', status: 404 };

  if (input.suspend) {
    if (restaurant.suspended_at) return { ok: false, error: 'already_suspended', status: 409 };
    const suspendedAt = new Date().toISOString();
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    const { error: updateError } = await admin
      .from('restaurants')
      .update({
        suspended_at: suspendedAt,
        suspension_reason: reason || null,
      })
      .eq('id', restaurantId);
    if (updateError) return { ok: false, error: 'suspend_failed', status: 500, detail: updateError.message };
    return { ok: true, suspendedAt };
  }

  if (!restaurant.suspended_at) return { ok: false, error: 'not_suspended', status: 409 };
  const { error: updateError } = await admin
    .from('restaurants')
    .update({ suspended_at: null, suspension_reason: null })
    .eq('id', restaurantId);
  if (updateError) return { ok: false, error: 'resume_failed', status: 500, detail: updateError.message };
  return { ok: true, suspendedAt: null };
}

type LicenseClockRow = {
  id: string;
  license_valid_until: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
};

async function writeRestaurantLicenseValidUntil(
  admin: SupabaseClient,
  restaurant: LicenseClockRow,
  licenseValidUntil: string,
): Promise<
  | { ok: true; licenseValidUntil: string }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const patch: Record<string, string | null> = { license_valid_until: licenseValidUntil };

  // Setting/extending does not auto-resume force suspend; only clear license_expired materialize.
  if (
    isRestaurantSuspended(restaurant.suspended_at) &&
    restaurant.suspension_reason === 'license_expired'
  ) {
    patch.suspended_at = null;
    patch.suspension_reason = null;
  }

  const { error: updateError } = await admin
    .from('restaurants')
    .update(patch)
    .eq('id', restaurant.id);
  if (updateError) {
    return { ok: false, error: 'license_update_failed', status: 500, detail: updateError.message };
  }
  return { ok: true, licenseValidUntil };
}

async function loadLicenseClockRow(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<
  | { ok: true; restaurant: LicenseClockRow }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const { data: restaurant, error: fetchError } = await admin
    .from('restaurants')
    .select('id, license_valid_until, suspended_at, suspension_reason')
    .eq('id', restaurantId)
    .maybeSingle();

  if (fetchError) return { ok: false, error: 'fetch_failed', status: 500, detail: fetchError.message };
  if (!restaurant) return { ok: false, error: 'not_found', status: 404 };
  return { ok: true, restaurant: restaurant as LicenseClockRow };
}

export async function applyRestaurantLicenseValidUntil(
  admin: SupabaseClient,
  restaurantId: string,
  licenseValidUntil: string,
): Promise<
  | { ok: true; licenseValidUntil: string }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const loaded = await loadLicenseClockRow(admin, restaurantId);
  if (!loaded.ok) return loaded;
  return writeRestaurantLicenseValidUntil(admin, loaded.restaurant, licenseValidUntil);
}

export async function extendRestaurantLicense(
  admin: SupabaseClient,
  restaurantId: string,
  period: LicenseExtendPeriod,
  now = new Date(),
): Promise<
  | { ok: true; licenseValidUntil: string }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const loaded = await loadLicenseClockRow(admin, restaurantId);
  if (!loaded.ok) return loaded;
  const licenseValidUntil = extendLicenseValidUntil(
    loaded.restaurant.license_valid_until,
    now,
    period,
  );
  return writeRestaurantLicenseValidUntil(admin, loaded.restaurant, licenseValidUntil);
}

export async function setRestaurantLicenseValidUntilDate(
  admin: SupabaseClient,
  restaurantId: string,
  ymd: unknown,
  now = new Date(),
): Promise<
  | { ok: true; licenseValidUntil: string }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const resolved = resolveLicenseCalendarDate(ymd, now);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, status: 400 };
  }
  return applyRestaurantLicenseValidUntil(admin, restaurantId, resolved.licenseValidUntil);
}

export async function issueRestaurantInstallCode(
  admin: SupabaseClient,
  input: { restaurantId: string; createdBy: string | null },
): Promise<
  | { ok: true; installationId: string; code: string; expiresAt: string }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const { data: restaurant, error: fetchError } = await admin
    .from('restaurants')
    .select('id, deployment_mode')
    .eq('id', input.restaurantId)
    .maybeSingle();

  if (fetchError) return { ok: false, error: 'fetch_failed', status: 500, detail: fetchError.message };
  if (!restaurant) return { ok: false, error: 'not_found', status: 404 };
  if (restaurant.deployment_mode !== 'on_prem') {
    return { ok: false, error: 'not_on_prem', status: 400 };
  }

  // Revoke any pending code so the unique partial index allows one pending.
  await admin
    .from('restaurant_installations')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('restaurant_id', input.restaurantId)
    .eq('status', 'pending');

  const code = mintInstallCode();
  const expiresAt = new Date(Date.now() + INSTALL_CODE_TTL_MS).toISOString();
  const { data: row, error: insertError } = await admin
    .from('restaurant_installations')
    .insert({
      restaurant_id: input.restaurantId,
      install_code_hash: hashLicenseSecret(code),
      status: 'pending',
      expires_at: expiresAt,
      created_by: input.createdBy,
    })
    .select('id')
    .single();

  if (insertError || !row) {
    return { ok: false, error: 'issue_failed', status: 500, detail: insertError?.message };
  }

  return { ok: true, installationId: row.id as string, code, expiresAt };
}

export async function revokeRestaurantInstallation(
  admin: SupabaseClient,
  installationId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number; detail?: string }> {
  const { data: row, error: fetchError } = await admin
    .from('restaurant_installations')
    .select('id, status, restaurant_id')
    .eq('id', installationId)
    .maybeSingle();

  if (fetchError) return { ok: false, error: 'fetch_failed', status: 500, detail: fetchError.message };
  if (!row) return { ok: false, error: 'not_found', status: 404 };
  if (row.status === 'revoked') return { ok: false, error: 'already_revoked', status: 409 };

  const { error: updateError } = await admin
    .from('restaurant_installations')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', installationId);

  if (updateError) return { ok: false, error: 'revoke_failed', status: 500, detail: updateError.message };
  return { ok: true };
}

export type ClaimInstallResult =
  | {
      ok: true;
      restaurantId: string;
      name: string;
      slug: string;
      ownerEmail: string;
      printLocale: string;
      countryCode: string;
      checkinCredential: string;
      licenseValidUntil: string | null;
      suspendedAt: string | null;
      suspensionReason: string | null;
      leaseToken: string;
      lease: ReturnType<typeof buildLicenseLeaseClaims>;
    }
  | { ok: false; error: string; status: number; detail?: string };

/**
 * Platform claim only: consume install code, mint lease + check-in credential.
 * Does not create Auth users or set restaurants.owner_id — store apply-claim does that locally.
 * “Claimed” on platform = restaurant_installations.status === 'claimed'.
 */
export async function claimOnPremInstallation(
  admin: SupabaseClient,
  input: { code: string; leaseSecret: string },
): Promise<ClaimInstallResult> {
  const code = input.code.trim().toLowerCase();
  if (!code) return { ok: false, error: 'code_required', status: 400 };

  const codeHash = hashLicenseSecret(code);
  const { data: installation, error: fetchError } = await admin
    .from('restaurant_installations')
    .select('id, restaurant_id, status, expires_at, revoked_at, consumed_at')
    .eq('install_code_hash', codeHash)
    .maybeSingle();

  if (fetchError) return { ok: false, error: 'fetch_failed', status: 500, detail: fetchError.message };
  if (!installation) return { ok: false, error: 'invalid_code', status: 404 };
  if (installation.status !== 'pending' || installation.revoked_at || installation.consumed_at) {
    return { ok: false, error: 'code_not_available', status: 409 };
  }
  if (Date.parse(installation.expires_at) < Date.now()) {
    return { ok: false, error: 'code_expired', status: 410 };
  }

  const { data: restaurant, error: restError } = await admin
    .from('restaurants')
    .select(
      'id, name, slug, owner_email, deployment_mode, print_locale, country_code, license_valid_until, suspended_at, suspension_reason',
    )
    .eq('id', installation.restaurant_id)
    .maybeSingle();

  if (restError || !restaurant) {
    return { ok: false, error: 'restaurant_missing', status: 500, detail: restError?.message };
  }
  if (restaurant.deployment_mode !== 'on_prem') {
    return { ok: false, error: 'not_on_prem', status: 400 };
  }
  if (!restaurant.owner_email) return { ok: false, error: 'owner_email_missing', status: 500 };

  const { data: existingClaimed } = await admin
    .from('restaurant_installations')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('status', 'claimed')
    .maybeSingle();
  if (existingClaimed) {
    return { ok: false, error: 'already_claimed', status: 409 };
  }

  const checkinCredential = mintCheckinSecret();
  const now = new Date();
  const forceSuspended = isOpsForceSuspended(restaurant.suspended_at, restaurant.suspension_reason);
  const lease = buildLicenseLeaseClaims({
    restaurantId: restaurant.id,
    licenseValidUntil: restaurant.license_valid_until,
    serverTime: now,
    forceSuspended,
    suspensionReason: forceSuspended ? restaurant.suspension_reason : null,
  });
  const leaseToken = signLicenseLease(lease, input.leaseSecret);

  const { error: updateRestError } = await admin
    .from('restaurants')
    .update({
      license_checked_at: lease.server_time,
      license_lease_until: lease.lease_until,
      license_lease_token: leaseToken,
    })
    .eq('id', restaurant.id);

  if (updateRestError) {
    return { ok: false, error: 'claim_restaurant_failed', status: 500, detail: updateRestError.message };
  }

  const claimedAt = now.toISOString();
  const { error: updateInstError } = await admin
    .from('restaurant_installations')
    .update({
      status: 'claimed',
      consumed_at: claimedAt,
      claimed_at: claimedAt,
      checkin_secret_hash: hashLicenseSecret(checkinCredential),
      last_checkin_at: claimedAt,
    })
    .eq('id', installation.id);

  if (updateInstError) {
    return { ok: false, error: 'claim_install_failed', status: 500, detail: updateInstError.message };
  }

  return {
    ok: true,
    restaurantId: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    ownerEmail: restaurant.owner_email,
    printLocale: restaurant.print_locale || 'pt',
    countryCode: restaurant.country_code || 'PT',
    checkinCredential,
    licenseValidUntil: restaurant.license_valid_until,
    suspendedAt: restaurant.suspended_at,
    suspensionReason: restaurant.suspension_reason,
    leaseToken,
    lease,
  };
}

export type CheckInResult =
  | {
      ok: true;
      restaurantId: string;
      licenseValidUntil: string | null;
      leaseToken: string;
      lease: ReturnType<typeof buildLicenseLeaseClaims>;
      desiredSuspended: boolean;
    }
  | { ok: false; error: string; status: number; detail?: string };

export async function checkInOnPremInstallation(
  admin: SupabaseClient,
  input: { checkinCredential: string; leaseSecret: string },
): Promise<CheckInResult> {
  const secret = input.checkinCredential.trim();
  if (!secret) return { ok: false, error: 'credential_required', status: 400 };
  const hash = hashLicenseSecret(secret);

  const { data: installation, error: fetchError } = await admin
    .from('restaurant_installations')
    .select('id, restaurant_id, status, revoked_at')
    .eq('checkin_secret_hash', hash)
    .eq('status', 'claimed')
    .maybeSingle();

  if (fetchError) return { ok: false, error: 'fetch_failed', status: 500, detail: fetchError.message };
  if (!installation || installation.revoked_at) {
    return { ok: false, error: 'invalid_credential', status: 401 };
  }

  const { data: restaurant, error: restError } = await admin
    .from('restaurants')
    .select('id, deployment_mode, license_valid_until, suspended_at, suspension_reason')
    .eq('id', installation.restaurant_id)
    .maybeSingle();

  if (restError || !restaurant) {
    return { ok: false, error: 'restaurant_missing', status: 500, detail: restError?.message };
  }
  if (restaurant.deployment_mode !== 'on_prem') {
    return { ok: false, error: 'not_on_prem', status: 400 };
  }

  const now = new Date();
  const desiredSuspended = isOpsForceSuspended(restaurant.suspended_at, restaurant.suspension_reason);
  const lease = buildLicenseLeaseClaims({
    restaurantId: restaurant.id,
    licenseValidUntil: restaurant.license_valid_until,
    serverTime: now,
    forceSuspended: desiredSuspended,
    suspensionReason: desiredSuspended ? restaurant.suspension_reason : null,
  });
  const leaseToken = signLicenseLease(lease, input.leaseSecret);
  const checkedAt = lease.server_time;

  const { error: updateRestError } = await admin
    .from('restaurants')
    .update({
      license_checked_at: checkedAt,
      license_lease_until: lease.lease_until,
      license_lease_token: leaseToken,
    })
    .eq('id', restaurant.id);

  if (updateRestError) {
    return { ok: false, error: 'checkin_failed', status: 500, detail: updateRestError.message };
  }

  await admin
    .from('restaurant_installations')
    .update({ last_checkin_at: checkedAt })
    .eq('id', installation.id);

  return {
    ok: true,
    restaurantId: restaurant.id,
    licenseValidUntil: restaurant.license_valid_until,
    leaseToken,
    lease,
    desiredSuspended,
  };
}
