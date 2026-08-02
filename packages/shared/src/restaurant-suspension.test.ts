import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LICENSE_OFFLINE_GRACE_DAYS_DEFAULT,
  LICENSE_OFFLINE_GRACE_MS,
  SUSPENSION_REASON_LICENSE_CLOCK_REGRESSED,
  SUSPENSION_REASON_LICENSE_EXPIRED,
  SUSPENSION_REASON_LICENSE_LEASE_INVALID,
  SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED,
  buildLicenseLeaseClaims,
  decideLicenseMaterialize,
  hashLicenseSecret,
  isRestaurantSuspended,
  licenseSuspensionAction,
  licenseSuspensionCtaHref,
  normalizeOfflineGraceDays,
  offlineGraceDaysToMs,
  signLicenseLease,
  verifyLicenseLease,
} from './restaurant-suspension';

describe('isRestaurantSuspended', () => {
  it('returns false for null/undefined/empty', () => {
    assert.equal(isRestaurantSuspended(null), false);
    assert.equal(isRestaurantSuspended(undefined), false);
    assert.equal(isRestaurantSuspended(''), false);
  });

  it('returns true when suspended_at is set', () => {
    assert.equal(isRestaurantSuspended('2026-06-23T12:00:00.000Z'), true);
  });
});

describe('license lease + materialize', () => {
  const secret = 'test-lease-secret';
  const rid = '11111111-1111-1111-1111-111111111111';

  it('signs and verifies lease', () => {
    const claims = buildLicenseLeaseClaims({
      restaurantId: rid,
      licenseValidUntil: '2026-12-01T00:00:00.000Z',
      serverTime: new Date('2026-07-30T12:00:00.000Z'),
      forceSuspended: false,
      suspensionReason: null,
    });
    const token = signLicenseLease(claims, secret);
    const got = verifyLicenseLease(token, secret);
    assert.ok(got);
    assert.equal(got.rid, rid);
    assert.equal(got.lease_until, '2026-08-06T12:00:00.000Z');
  });

  it('hashLicenseSecret is stable sha256 hex', () => {
    assert.equal(hashLicenseSecret('abc').length, 64);
    assert.equal(hashLicenseSecret('abc'), hashLicenseSecret('abc'));
  });

  it('on_prem suspends when lease missing', () => {
    const d = decideLicenseMaterialize({
      now: new Date('2026-07-30T12:00:00.000Z'),
      restaurantId: rid,
      currentlySuspended: false,
      forceSuspended: false,
      forceReason: null,
      licenseValidUntil: null,
      licenseCheckedAt: null,
      licenseLeaseUntil: null,
      leaseToken: null,
      leaseSecret: secret,
      deploymentMode: 'on_prem',
    });
    assert.deepEqual(d, { action: 'suspend', reason: SUSPENSION_REASON_LICENSE_LEASE_INVALID });
  });

  it('on_prem suspends when past lease_until', () => {
    const serverTime = new Date('2026-07-01T00:00:00.000Z');
    const claims = buildLicenseLeaseClaims({
      restaurantId: rid,
      licenseValidUntil: '2027-01-01T00:00:00.000Z',
      serverTime,
      forceSuspended: false,
      suspensionReason: null,
      graceMs: LICENSE_OFFLINE_GRACE_MS,
    });
    const token = signLicenseLease(claims, secret);
    const d = decideLicenseMaterialize({
      now: new Date(serverTime.getTime() + LICENSE_OFFLINE_GRACE_MS + 1000),
      restaurantId: rid,
      currentlySuspended: false,
      forceSuspended: false,
      forceReason: null,
      licenseValidUntil: claims.valid_until,
      licenseCheckedAt: claims.server_time,
      licenseLeaseUntil: claims.lease_until,
      leaseToken: token,
      leaseSecret: secret,
      deploymentMode: 'on_prem',
    });
    assert.deepEqual(d, {
      action: 'suspend',
      reason: SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED,
    });
  });

  it('on_prem suspends when past valid_until', () => {
    const serverTime = new Date('2026-07-30T00:00:00.000Z');
    const claims = buildLicenseLeaseClaims({
      restaurantId: rid,
      licenseValidUntil: '2026-07-29T00:00:00.000Z',
      serverTime,
      forceSuspended: false,
      suspensionReason: null,
    });
    const token = signLicenseLease(claims, secret);
    const d = decideLicenseMaterialize({
      now: new Date('2026-07-30T12:00:00.000Z'),
      restaurantId: rid,
      currentlySuspended: false,
      forceSuspended: false,
      forceReason: null,
      licenseValidUntil: claims.valid_until,
      licenseCheckedAt: claims.server_time,
      licenseLeaseUntil: claims.lease_until,
      leaseToken: token,
      leaseSecret: secret,
      deploymentMode: 'on_prem',
    });
    assert.deepEqual(d, { action: 'suspend', reason: SUSPENSION_REASON_LICENSE_EXPIRED });
  });

  it('on_prem suspends on clock regression', () => {
    const serverTime = new Date('2026-07-30T12:00:00.000Z');
    const claims = buildLicenseLeaseClaims({
      restaurantId: rid,
      licenseValidUntil: '2027-01-01T00:00:00.000Z',
      serverTime,
      forceSuspended: false,
      suspensionReason: null,
    });
    const token = signLicenseLease(claims, secret);
    const d = decideLicenseMaterialize({
      now: new Date('2026-07-20T12:00:00.000Z'),
      restaurantId: rid,
      currentlySuspended: false,
      forceSuspended: false,
      forceReason: null,
      licenseValidUntil: claims.valid_until,
      licenseCheckedAt: claims.server_time,
      licenseLeaseUntil: claims.lease_until,
      leaseToken: token,
      leaseSecret: secret,
      deploymentMode: 'on_prem',
    });
    assert.deepEqual(d, { action: 'suspend', reason: SUSPENSION_REASON_LICENSE_CLOCK_REGRESSED });
  });

  it('on_prem clears when healthy after suspend', () => {
    const serverTime = new Date('2026-07-30T12:00:00.000Z');
    const claims = buildLicenseLeaseClaims({
      restaurantId: rid,
      licenseValidUntil: '2027-01-01T00:00:00.000Z',
      serverTime,
      forceSuspended: false,
      suspensionReason: null,
    });
    const token = signLicenseLease(claims, secret);
    const d = decideLicenseMaterialize({
      now: new Date('2026-07-30T12:05:00.000Z'),
      restaurantId: rid,
      currentlySuspended: true,
      forceSuspended: false,
      forceReason: SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED,
      licenseValidUntil: claims.valid_until,
      licenseCheckedAt: claims.server_time,
      licenseLeaseUntil: claims.lease_until,
      leaseToken: token,
      leaseSecret: secret,
      deploymentMode: 'on_prem',
    });
    assert.deepEqual(d, { action: 'clear' });
  });

  it('cloud materializes license expiry', () => {
    const d = decideLicenseMaterialize({
      now: new Date('2026-08-01T00:00:00.000Z'),
      restaurantId: rid,
      currentlySuspended: false,
      forceSuspended: false,
      forceReason: null,
      licenseValidUntil: '2026-07-01T00:00:00.000Z',
      licenseCheckedAt: null,
      licenseLeaseUntil: null,
      leaseToken: null,
      leaseSecret: null,
      deploymentMode: 'cloud',
    });
    assert.deepEqual(d, { action: 'suspend', reason: SUSPENSION_REASON_LICENSE_EXPIRED });
  });
});

describe('licenseSuspensionAction', () => {
  it('maps suspension reasons to customer actions', () => {
    assert.equal(licenseSuspensionAction(SUSPENSION_REASON_LICENSE_EXPIRED), 'renew');
    assert.equal(licenseSuspensionAction(SUSPENSION_REASON_LICENSE_LEASE_INVALID), 'reconfigure');
    assert.equal(
      licenseSuspensionAction(SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED),
      'network_or_clock',
    );
    assert.equal(licenseSuspensionAction(SUSPENSION_REASON_LICENSE_CLOCK_REGRESSED), 'network_or_clock');
    assert.equal(licenseSuspensionAction('ops_force'), 'platform');
    assert.equal(licenseSuspensionAction(null), 'generic');
    assert.equal(licenseSuspensionCtaHref('reconfigure'), '/setup');
    assert.equal(licenseSuspensionCtaHref('renew'), null);
  });
});

describe('offline grace days', () => {
  it('normalizeOfflineGraceDays defaults and clamps', () => {
    assert.equal(normalizeOfflineGraceDays(null), LICENSE_OFFLINE_GRACE_DAYS_DEFAULT);
    assert.equal(normalizeOfflineGraceDays(0), LICENSE_OFFLINE_GRACE_DAYS_DEFAULT);
    assert.equal(normalizeOfflineGraceDays(3), 3);
    assert.equal(normalizeOfflineGraceDays(400), 365);
    assert.equal(offlineGraceDaysToMs(3), 3 * 24 * 60 * 60 * 1000);
  });

  it('buildLicenseLeaseClaims uses custom graceMs', () => {
    const serverTime = new Date('2026-07-01T00:00:00.000Z');
    const claims = buildLicenseLeaseClaims({
      restaurantId: '11111111-1111-1111-1111-111111111111',
      licenseValidUntil: null,
      serverTime,
      forceSuspended: false,
      suspensionReason: null,
      graceMs: offlineGraceDaysToMs(3),
    });
    assert.equal(claims.lease_until, '2026-07-04T00:00:00.000Z');
  });
});
