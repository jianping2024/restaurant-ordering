import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SUSPENSION_REASON_LICENSE_CLOCK_REGRESSED,
  SUSPENSION_REASON_LICENSE_EXPIRED,
  SUSPENSION_REASON_LICENSE_LEASE_INVALID,
  SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED,
  buildLicenseLeaseClaims,
  ensurePrintAgentStaff,
  extendLicenseValidUntil,
  hashLicenseSecret,
  isRestaurantSuspended,
  mintCheckinSecret,
  mintInstallCode,
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

export async function extendRestaurantLicense(
  admin: SupabaseClient,
  restaurantId: string,
  period: LicenseExtendPeriod,
  now = new Date(),
): Promise<
  | { ok: true; licenseValidUntil: string }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const { data: restaurant, error: fetchError } = await admin
    .from('restaurants')
    .select('id, license_valid_until, suspended_at, suspension_reason')
    .eq('id', restaurantId)
    .maybeSingle();

  if (fetchError) return { ok: false, error: 'fetch_failed', status: 500, detail: fetchError.message };
  if (!restaurant) return { ok: false, error: 'not_found', status: 404 };

  const licenseValidUntil = extendLicenseValidUntil(restaurant.license_valid_until, now, period);
  const patch: Record<string, string | null> = { license_valid_until: licenseValidUntil };

  // Extending does not auto-resume force suspend; only clear license_expired materialize.
  if (
    isRestaurantSuspended(restaurant.suspended_at) &&
    restaurant.suspension_reason === 'license_expired'
  ) {
    patch.suspended_at = null;
    patch.suspension_reason = null;
  }

  const { error: updateError } = await admin.from('restaurants').update(patch).eq('id', restaurantId);
  if (updateError) return { ok: false, error: 'extend_failed', status: 500, detail: updateError.message };
  return { ok: true, licenseValidUntil };
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
      slug: string;
      ownerEmail: string;
      checkinCredential: string;
      licenseValidUntil: string | null;
      leaseToken: string;
      lease: ReturnType<typeof buildLicenseLeaseClaims>;
    }
  | { ok: false; error: string; status: number; detail?: string };

export async function claimOnPremInstallation(
  admin: SupabaseClient,
  input: { code: string; ownerPassword: string; leaseSecret: string },
): Promise<ClaimInstallResult> {
  const code = input.code.trim().toLowerCase();
  if (!code) return { ok: false, error: 'code_required', status: 400 };
  if (!input.ownerPassword || input.ownerPassword.length < 6) {
    return { ok: false, error: 'password_too_short', status: 400 };
  }

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
      'id, slug, owner_email, owner_id, deployment_mode, license_valid_until, suspended_at, suspension_reason',
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
  if (restaurant.owner_id) return { ok: false, error: 'already_claimed', status: 409 };

  // One claimed per restaurant — revoke older claimed rows if any (reinstall path uses new pending).
  await admin
    .from('restaurant_installations')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('restaurant_id', restaurant.id)
    .eq('status', 'claimed');

  const { data: userData, error: createUserError } = await admin.auth.admin.createUser({
    email: restaurant.owner_email,
    password: input.ownerPassword,
    email_confirm: true,
  });
  if (createUserError || !userData.user) {
    const msg = createUserError?.message || '';
    if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
      return { ok: false, error: 'email_exists', status: 409, detail: msg };
    }
    return { ok: false, error: 'create_user_failed', status: 400, detail: msg };
  }

  const ownerId = userData.user.id;
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
      owner_id: ownerId,
      license_checked_at: lease.server_time,
      license_lease_until: lease.lease_until,
      license_lease_token: leaseToken,
    })
    .eq('id', restaurant.id);

  if (updateRestError) {
    await admin.auth.admin.deleteUser(ownerId);
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
    await admin.from('restaurants').update({ owner_id: null }).eq('id', restaurant.id);
    await admin.auth.admin.deleteUser(ownerId);
    return { ok: false, error: 'claim_install_failed', status: 500, detail: updateInstError.message };
  }

  const ensure = await ensurePrintAgentStaff(admin, {
    restaurantId: restaurant.id,
    restaurantSlug: restaurant.slug,
  });
  if (!ensure.ok) {
    // Non-fatal for claim identity; print can be repaired later. Keep claim.
  }

  return {
    ok: true,
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    ownerEmail: restaurant.owner_email,
    checkinCredential,
    licenseValidUntil: restaurant.license_valid_until,
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
