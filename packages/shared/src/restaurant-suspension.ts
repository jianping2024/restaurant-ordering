import { createHash, randomBytes } from 'crypto';
import { signHmacJwt, verifyHmacJwt } from './hmac-jwt';
import {
  addLisbonCalendarPeriod,
  licenseValidUntilEndOfLisbonDay,
  lisbonCalendarDateFromInstant,
} from './license-calendar';

/** Sole runtime gate remains isRestaurantSuspended(suspended_at). */
export function isRestaurantSuspended(suspendedAt: string | null | undefined): boolean {
  return suspendedAt != null && suspendedAt !== '';
}

export const LICENSE_OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export const SUSPENSION_REASON_LICENSE_EXPIRED = 'license_expired';
export const SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED = 'license_offline_grace_exceeded';
export const SUSPENSION_REASON_LICENSE_CLOCK_REGRESSED = 'license_clock_regressed';
export const SUSPENSION_REASON_LICENSE_LEASE_INVALID = 'license_lease_invalid';

export type DeploymentMode = 'cloud' | 'on_prem';
export type LicenseExtendPeriod = '1d' | '1m' | '1y';

export type LicenseLeaseClaims = {
  rid: string;
  valid_until: string | null;
  server_time: string;
  lease_until: string;
  force_suspended: boolean;
  suspension_reason: string | null;
};

export type MaterializeDecision =
  | { action: 'none' }
  | { action: 'suspend'; reason: string }
  | { action: 'clear' };

const CLOCK_REGRESSION_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Relative extend on the Lisbon civil calendar; result is always that day's
 * Lisbon 23:59:59.999 (sole Ops representation for a license calendar day).
 */
export function extendLicenseValidUntil(
  current: string | null | undefined,
  now: Date,
  period: LicenseExtendPeriod,
): string {
  const baseMs = Math.max(now.getTime(), current ? Date.parse(current) : 0);
  const baseInstant = new Date(Number.isFinite(baseMs) ? baseMs : now.getTime());
  const baseYmd = lisbonCalendarDateFromInstant(baseInstant);
  const nextYmd = addLisbonCalendarPeriod(baseYmd, period);
  return licenseValidUntilEndOfLisbonDay(nextYmd);
}

export function hashLicenseSecret(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

export function mintInstallCode(): string {
  // 12 hex chars — short enough to type, not a 6-digit print pairing code.
  return randomBytes(6).toString('hex');
}

export function mintCheckinSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function buildLicenseLeaseClaims(input: {
  restaurantId: string;
  licenseValidUntil: string | null;
  serverTime: Date;
  forceSuspended: boolean;
  suspensionReason: string | null;
  graceMs?: number;
}): LicenseLeaseClaims {
  const graceMs = input.graceMs ?? LICENSE_OFFLINE_GRACE_MS;
  return {
    rid: input.restaurantId,
    valid_until: input.licenseValidUntil,
    server_time: input.serverTime.toISOString(),
    lease_until: new Date(input.serverTime.getTime() + graceMs).toISOString(),
    force_suspended: input.forceSuspended,
    suspension_reason: input.suspensionReason,
  };
}

export function signLicenseLease(claims: LicenseLeaseClaims, secret: string): string {
  return signHmacJwt(claims, secret);
}

export function verifyLicenseLease(token: string, secret: string): LicenseLeaseClaims | null {
  const claims = verifyHmacJwt<LicenseLeaseClaims>(token, secret);
  if (!claims || typeof claims.rid !== 'string') return null;
  if (typeof claims.server_time !== 'string' || typeof claims.lease_until !== 'string') return null;
  if (claims.valid_until != null && typeof claims.valid_until !== 'string') return null;
  if (typeof claims.force_suspended !== 'boolean') return null;
  return claims;
}

/**
 * Decide whether to write/clear suspended_at. Never a second runtime gate —
 * callers apply the decision to restaurants.suspended_at only.
 */
export function decideLicenseMaterialize(input: {
  now: Date;
  restaurantId: string;
  currentlySuspended: boolean;
  /** Cloud / platform force flag mirrored into lease (on-prem) or direct (cloud). */
  forceSuspended: boolean;
  forceReason: string | null;
  licenseValidUntil: string | null | undefined;
  /** Last platform server_time; required for clock regression on on-prem. */
  licenseCheckedAt: string | null | undefined;
  licenseLeaseUntil: string | null | undefined;
  leaseToken: string | null | undefined;
  leaseSecret: string | null | undefined;
  deploymentMode: DeploymentMode;
}): MaterializeDecision {
  const { now, deploymentMode } = input;

  if (deploymentMode === 'on_prem') {
    if (!input.leaseToken || !input.leaseSecret) {
      return { action: 'suspend', reason: SUSPENSION_REASON_LICENSE_LEASE_INVALID };
    }
    const claims = verifyLicenseLease(input.leaseToken, input.leaseSecret);
    if (!claims || claims.rid !== input.restaurantId) {
      return { action: 'suspend', reason: SUSPENSION_REASON_LICENSE_LEASE_INVALID };
    }

    if (claims.force_suspended) {
      return {
        action: 'suspend',
        reason: claims.suspension_reason || 'platform_suspended',
      };
    }

    const checkedAtMs = Date.parse(claims.server_time);
    if (Number.isFinite(checkedAtMs) && now.getTime() + CLOCK_REGRESSION_TOLERANCE_MS < checkedAtMs) {
      return { action: 'suspend', reason: SUSPENSION_REASON_LICENSE_CLOCK_REGRESSED };
    }

    if (claims.valid_until) {
      const untilMs = Date.parse(claims.valid_until);
      if (Number.isFinite(untilMs) && now.getTime() > untilMs) {
        return { action: 'suspend', reason: SUSPENSION_REASON_LICENSE_EXPIRED };
      }
    }

    const leaseUntilMs = Date.parse(claims.lease_until);
    if (!Number.isFinite(leaseUntilMs) || now.getTime() > leaseUntilMs) {
      return { action: 'suspend', reason: SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED };
    }

    // Healthy lease + no force → clear any prior materialize / platform suspend.
    if (input.currentlySuspended) return { action: 'clear' };
    return { action: 'none' };
  }

  // cloud: platform writes suspended_at directly; also materialize expiry locally if set.
  if (input.forceSuspended) {
    return {
      action: 'suspend',
      reason: input.forceReason || 'platform_suspended',
    };
  }
  if (input.licenseValidUntil) {
    const untilMs = Date.parse(input.licenseValidUntil);
    if (Number.isFinite(untilMs) && now.getTime() > untilMs) {
      return { action: 'suspend', reason: SUSPENSION_REASON_LICENSE_EXPIRED };
    }
  }
  if (input.currentlySuspended) {
    const r = input.forceReason;
    if (
      r === SUSPENSION_REASON_LICENSE_EXPIRED ||
      r === SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED ||
      r === SUSPENSION_REASON_LICENSE_CLOCK_REGRESSED ||
      r === SUSPENSION_REASON_LICENSE_LEASE_INVALID
    ) {
      // Expiry cleared by extend — allow clear when no longer past valid_until and not force.
      if (!input.licenseValidUntil || Date.parse(input.licenseValidUntil) >= now.getTime()) {
        return { action: 'clear' };
      }
    }
  }
  return { action: 'none' };
}

export function isDeploymentMode(value: unknown): value is DeploymentMode {
  return value === 'cloud' || value === 'on_prem';
}

export function isLicenseExtendPeriod(value: unknown): value is LicenseExtendPeriod {
  return value === '1d' || value === '1m' || value === '1y';
}
