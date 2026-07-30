import type { SupabaseClient } from '@supabase/supabase-js';
import {
  decideLicenseMaterialize,
  isRestaurantSuspended,
  type DeploymentMode,
} from '@mesa/shared';

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
  return process.env.MESA_LICENSE_LEASE_SECRET?.trim() || null;
}

/**
 * Apply decideLicenseMaterialize onto restaurants.suspended_at — sole runtime gate.
 * Lifecycle one-shot (dashboard enter / explicit reconcile), not interval polling.
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

  // clear
  const { error: updateError } = await admin
    .from('restaurants')
    .update({ suspended_at: null, suspension_reason: null })
    .eq('id', restaurantId);
  return { changed: !updateError, action: 'clear' };
}

/**
 * Optional platform check-in for on-prem, then materialize.
 * Env: MESA_PLATFORM_LICENSE_URL (e.g. http://127.0.0.1:3001), MESA_LICENSE_CHECKIN_CREDENTIAL,
 * MESA_LICENSE_LEASE_SECRET (same HMAC secret as platform).
 */
export async function syncOnPremLicenseFromPlatform(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ ok: boolean; error?: string }> {
  const base = process.env.MESA_PLATFORM_LICENSE_URL?.trim().replace(/\/$/, '');
  const credential = process.env.MESA_LICENSE_CHECKIN_CREDENTIAL?.trim();
  if (!base || !credential) {
    await applyLicenseMaterialize(admin, restaurantId);
    return { ok: true };
  }

  try {
    const res = await fetch(`${base}/api/platform/license/check-in`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    const json = (await res.json()) as {
      error?: string;
      leaseToken?: string;
      lease?: { server_time: string; lease_until: string; valid_until: string | null };
      licenseValidUntil?: string | null;
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
      })
      .eq('id', restaurantId);

    await applyLicenseMaterialize(admin, restaurantId);
    return { ok: true };
  } catch (e) {
    await applyLicenseMaterialize(admin, restaurantId);
    return { ok: false, error: e instanceof Error ? e.message : 'checkin_network_error' };
  }
}
