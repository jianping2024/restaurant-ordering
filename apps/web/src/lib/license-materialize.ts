import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  decideLicenseMaterialize,
  ensurePrintAgentStaff,
  isRestaurantSuspended,
  normalizeBuffetServiceMode,
  type DeploymentMode,
} from '@mesa/shared';
import {
  loadPlatformLicenseConfig,
  persistPlatformLicenseConfig,
  type PlatformLicenseConfig,
} from '@/lib/license-platform-config';
import { accountPasswordPolicyError } from '@/lib/auth/account-password-policy';

type LicenseRestaurantRow = {
  id: string;
  deployment_mode: DeploymentMode | string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  license_valid_until: string | null;
  license_checked_at: string | null;
  license_lease_until: string | null;
  license_lease_token: string | null;
};

function leaseSecret(): string | null {
  // Fail closed: do not use bare MESA_LICENSE_LEASE_SECRET without full check-in config.
  // Otherwise deleting platform.json while leaving lease secret in .env keeps the store open.
  return loadPlatformLicenseConfig()?.leaseSecret || null;
}

/**
 * Apply decideLicenseMaterialize onto restaurants.suspended_at — sole runtime gate writer.
 * Prefer reconcileRestaurantLicense at business boundaries; this stays for sync/claim internals.
 */
export async function applyLicenseMaterialize(
  admin: SupabaseClient,
  restaurantId: string,
  now = new Date(),
): Promise<{ changed: boolean; action: string }> {
  const { data: row, error } = await admin
    .from('restaurants')
    .select(
      'id, deployment_mode, suspended_at, suspension_reason, license_valid_until, license_checked_at, license_lease_until, license_lease_token',
    )
    .eq('id', restaurantId)
    .maybeSingle();

  if (error || !row) return { changed: false, action: 'none' };

  const restaurant = row as LicenseRestaurantRow;
  const mode: DeploymentMode =
    restaurant.deployment_mode === 'on_prem' ? 'on_prem' : 'cloud';

  const decision = decideLicenseMaterialize({
    now,
    restaurantId: restaurant.id,
    currentlySuspended: isRestaurantSuspended(restaurant.suspended_at),
    forceSuspended: false,
    forceReason: restaurant.suspension_reason,
    licenseValidUntil: restaurant.license_valid_until,
    licenseCheckedAt: restaurant.license_checked_at,
    licenseLeaseUntil: restaurant.license_lease_until,
    leaseToken: restaurant.license_lease_token,
    leaseSecret: leaseSecret(),
    deploymentMode: mode,
  });

  if (decision.action === 'none') return { changed: false, action: 'none' };

  if (decision.action === 'suspend') {
    if (isRestaurantSuspended(restaurant.suspended_at) && restaurant.suspension_reason === decision.reason) {
      return { changed: false, action: 'suspend' };
    }
    const { error: updateError } = await admin
      .from('restaurants')
      .update({
        suspended_at: restaurant.suspended_at || now.toISOString(),
        suspension_reason: decision.reason,
      })
      .eq('id', restaurantId);
    return { changed: !updateError, action: 'suspend' };
  }

  const { error: updateError } = await admin
    .from('restaurants')
    .update({ suspended_at: null, suspension_reason: null })
    .eq('id', restaurantId);
  return { changed: !updateError, action: 'clear' };
}

export type ReconcileRestaurantLicenseResult = {
  suspended_at: string | null;
  suspension_reason: string | null;
  license_valid_until: string | null;
};

/**
 * Sole public orchestrator before isRestaurantSuspended gates (login / order / dashboard).
 * on_prem + checkIn (default true): syncOnPremLicenseFromPlatform then read back.
 * cloud, or checkIn:false (hot guest paths): applyLicenseMaterialize only — no platform round-trip.
 * Lifecycle one-shot per request boundary — not interval polling.
 */
export async function reconcileRestaurantLicense(
  admin: SupabaseClient,
  restaurantId: string,
  options?: { checkIn?: boolean },
): Promise<ReconcileRestaurantLicenseResult | null> {
  const wantCheckIn = options?.checkIn !== false;

  const { data: modeRow } = await admin
    .from('restaurants')
    .select('deployment_mode')
    .eq('id', restaurantId)
    .maybeSingle();

  if (wantCheckIn && modeRow?.deployment_mode === 'on_prem') {
    await syncOnPremLicenseFromPlatform(admin, restaurantId);
  } else {
    await applyLicenseMaterialize(admin, restaurantId);
  }

  const { data } = await admin
    .from('restaurants')
    .select('suspended_at, suspension_reason, license_valid_until')
    .eq('id', restaurantId)
    .maybeSingle();

  return data
    ? {
        suspended_at: data.suspended_at ?? null,
        suspension_reason: data.suspension_reason ?? null,
        license_valid_until: data.license_valid_until ?? null,
      }
    : null;
}

/**
 * Optional platform check-in for on-prem, then materialize.
 * Config: sole loader `loadPlatformLicenseConfig` (file then env).
 * Call via reconcileRestaurantLicense at gates — not a second public gate entry.
 */
export async function syncOnPremLicenseFromPlatform(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ ok: boolean; error?: string }> {
  const config = loadPlatformLicenseConfig();
  if (!config) {
    await applyLicenseMaterialize(admin, restaurantId);
    return { ok: true };
  }

  try {
    const res = await fetch(`${config.platformUrl}/api/platform/license/check-in`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.checkinCredential}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    const json = (await res.json()) as {
      error?: string;
      leaseToken?: string;
      lease?: { server_time: string; lease_until: string; valid_until: string | null };
      licenseValidUntil?: string | null;
      plan?: string | null;
      proValidUntil?: string | null;
      buffetServiceMode?: string | null;
    };
    if (!res.ok || !json.leaseToken || !json.lease) {
      await applyLicenseMaterialize(admin, restaurantId);
      return { ok: false, error: json.error || 'checkin_failed' };
    }

    await admin
      .from('restaurants')
      .update({
        license_valid_until: json.licenseValidUntil ?? json.lease.valid_until,
        license_checked_at: json.lease.server_time,
        license_lease_until: json.lease.lease_until,
        license_lease_token: json.leaseToken,
        buffet_service_mode: normalizeBuffetServiceMode(json.buffetServiceMode),
        ...(typeof json.plan === 'string' ? { plan: json.plan } : {}),
        ...(json.proValidUntil !== undefined ? { pro_valid_until: json.proValidUntil } : {}),
      })
      .eq('id', restaurantId);

    await applyLicenseMaterialize(admin, restaurantId);
    return { ok: true };
  } catch (e) {
    await applyLicenseMaterialize(admin, restaurantId);
    return { ok: false, error: e instanceof Error ? e.message : 'checkin_network_error' };
  }
}

export type PlatformClaimSnapshot = {
  restaurantId: string;
  name: string;
  slug: string;
  ownerEmail: string;
  printLocale: string;
  countryCode: string;
  /** Platform buffet_service_mode; missing/invalid → classic. */
  buffetServiceMode?: string | null;
  checkinCredential: string;
  licenseValidUntil: string | null;
  plan?: string | null;
  proValidUntil?: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  leaseToken: string;
  lease: { server_time: string; lease_until: string; valid_until: string | null };
};

export type ApplyOnPremClaimResult =
  | { ok: true; restaurantId: string; ownerEmail: string; slug: string }
  | { ok: false; error: string; status: number; detail?: string };

/**
 * Sole local apply-claim: same restaurantId as platform, local Auth owner, persist platform config.
 * If the restaurant was already claimed locally (owner_id set), rebind license lease + config
 * and reset the owner password — used when host `license-state/platform.json` was lost.
 */
export async function applyOnPremClaim(
  admin: SupabaseClient,
  input: {
    snapshot: PlatformClaimSnapshot;
    ownerPassword: string;
    platformConfig: PlatformLicenseConfig;
  },
): Promise<ApplyOnPremClaimResult> {
  const password = input.ownerPassword || '';
  const passwordError = accountPasswordPolicyError(password);
  if (passwordError) {
    return { ok: false, error: passwordError, status: 400 };
  }

  const snap = input.snapshot;
  const restaurantId = snap.restaurantId;
  if (!restaurantId || !snap.ownerEmail || !snap.slug || !snap.name) {
    return { ok: false, error: 'invalid_claim_snapshot', status: 400 };
  }

  const { data: existing, error: existingError } = await admin
    .from('restaurants')
    .select('id, owner_id, owner_email, deployment_mode')
    .eq('id', restaurantId)
    .maybeSingle();

  if (existingError) {
    return { ok: false, error: 'fetch_failed', status: 500, detail: existingError.message };
  }

  const licensePatch = {
    name: snap.name,
    slug: snap.slug,
    owner_email: snap.ownerEmail,
    print_locale: snap.printLocale || 'pt',
    country_code: snap.countryCode || 'PT',
    buffet_service_mode: normalizeBuffetServiceMode(snap.buffetServiceMode),
    deployment_mode: 'on_prem' as const,
    license_valid_until: snap.licenseValidUntil,
    license_checked_at: snap.lease.server_time,
    license_lease_until: snap.lease.lease_until,
    license_lease_token: snap.leaseToken,
    suspended_at: snap.suspendedAt,
    suspension_reason: snap.suspensionReason,
    ...(typeof snap.plan === 'string' ? { plan: snap.plan } : {}),
    ...(snap.proValidUntil !== undefined ? { pro_valid_until: snap.proValidUntil } : {}),
  };

  // Rebind: restaurant already claimed locally — refresh lease/config, reset owner password.
  if (existing?.owner_id) {
    const existingEmail = (existing.owner_email || '').trim().toLowerCase();
    const snapEmail = snap.ownerEmail.trim().toLowerCase();
    if (existingEmail && existingEmail !== snapEmail) {
      return { ok: false, error: 'owner_email_mismatch', status: 409 };
    }

    const { error: pwdError } = await admin.auth.admin.updateUserById(existing.owner_id, {
      password,
      email: snap.ownerEmail,
      email_confirm: true,
    });
    if (pwdError) {
      return { ok: false, error: 'password_update_failed', status: 400, detail: pwdError.message };
    }

    const { error: updateError } = await admin
      .from('restaurants')
      .update(licensePatch)
      .eq('id', restaurantId);
    if (updateError) {
      return { ok: false, error: 'restaurant_update_failed', status: 500, detail: updateError.message };
    }

    try {
      persistPlatformLicenseConfig(input.platformConfig);
    } catch (e) {
      return {
        ok: false,
        error: 'config_persist_failed',
        status: 500,
        detail: e instanceof Error ? e.message : String(e),
      };
    }

    await applyLicenseMaterialize(admin, restaurantId);
    return { ok: true, restaurantId, ownerEmail: snap.ownerEmail, slug: snap.slug };
  }

  const { data: userData, error: createUserError } = await admin.auth.admin.createUser({
    email: snap.ownerEmail,
    password,
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

  const restaurantPatch = {
    owner_id: ownerId,
    ...licensePatch,
  };

  if (existing) {
    const { error: updateError } = await admin
      .from('restaurants')
      .update(restaurantPatch)
      .eq('id', restaurantId);
    if (updateError) {
      await admin.auth.admin.deleteUser(ownerId);
      return { ok: false, error: 'restaurant_update_failed', status: 500, detail: updateError.message };
    }
  } else {
    const { error: insertError } = await admin.from('restaurants').insert({
      id: restaurantId,
      ...restaurantPatch,
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(ownerId);
      return { ok: false, error: 'restaurant_insert_failed', status: 500, detail: insertError.message };
    }
  }

  const ensure = await ensurePrintAgentStaff(admin, {
    restaurantId,
    restaurantSlug: snap.slug,
  });
  if (!ensure.ok) {
    // Non-fatal; print can be repaired later.
  }

  try {
    persistPlatformLicenseConfig(input.platformConfig);
  } catch (e) {
    await admin.from('restaurants').update({ owner_id: null }).eq('id', restaurantId);
    await admin.auth.admin.deleteUser(ownerId);
    return {
      ok: false,
      error: 'config_persist_failed',
      status: 500,
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  await applyLicenseMaterialize(admin, restaurantId);
  return { ok: true, restaurantId, ownerEmail: snap.ownerEmail, slug: snap.slug };
}
