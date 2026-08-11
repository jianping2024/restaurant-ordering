import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SUSPENSION_REASON_LICENSE_EXPIRED,
  SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED,
} from '@mesa/shared';
import {
  BUSINESS_STATUS_LABEL,
  INSTALLATION_STATUS_LABEL,
  formatOpsPrimaryLabel,
  isOpsPrimarySuspended,
  isOpsRestaurantDeletable,
  resolveInstallPhase,
  resolveOpsLicenseHealth,
  suspensionReasonLabel,
} from './ops-license-status';

describe('ops-license-status', () => {
  const now = new Date('2026-08-02T12:00:00.000Z');

  it('install phase priority claimed > pending > none', () => {
    assert.equal(resolveInstallPhase({ claimed: true, pending: true }), 'claimed');
    assert.equal(resolveInstallPhase({ claimed: false, pending: true }), 'pending');
    assert.equal(resolveInstallPhase({ claimed: false, pending: false }), 'none');
  });

  it('labels are sole Chinese nouns', () => {
    assert.equal(INSTALLATION_STATUS_LABEL.none, '未签发');
    assert.equal(INSTALLATION_STATUS_LABEL.pending, '待认领');
    assert.equal(INSTALLATION_STATUS_LABEL.claimed, '已认领');
    assert.equal(BUSINESS_STATUS_LABEL.open, '营业中');
    assert.equal(BUSINESS_STATUS_LABEL.suspended, '已暂停');
    assert.equal(suspensionReasonLabel(SUSPENSION_REASON_LICENSE_EXPIRED), '授权到期');
    assert.equal(
      suspensionReasonLabel(SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED),
      '离线超时',
    );
  });

  it('primary: healthy claimed on-prem → 营业中 only (no dual 已认领)', () => {
    const h = resolveOpsLicenseHealth({
      now,
      deploymentMode: 'on_prem',
      suspendedAt: null,
      suspensionReason: null,
      licenseValidUntil: '2026-12-01T22:59:59.999Z',
      licenseCheckedAt: '2026-08-02T10:00:00.000Z',
      lastCheckinAt: '2026-08-02T10:00:00.000Z',
      installPhase: 'claimed',
      offlineGraceDays: 7,
    });
    assert.equal(h.primary.kind, 'open');
    assert.equal(h.primary.label, '营业中');
    assert.ok(h.lastOnline);
    assert.match(h.lastOnline.line, /最近在线/);
    assert.equal(h.lastOnline.daysAgo, 0);
  });

  it('primary: pending install when open', () => {
    const h = resolveOpsLicenseHealth({
      now,
      deploymentMode: 'on_prem',
      suspendedAt: null,
      suspensionReason: null,
      licenseValidUntil: null,
      licenseCheckedAt: null,
      lastCheckinAt: null,
      installPhase: 'pending',
      offlineGraceDays: 7,
    });
    assert.equal(h.primary.kind, 'install');
    assert.equal(h.primary.label, '待认领');
    assert.equal(h.lastOnline, null);
  });

  it('primary: db suspend wins with resume', () => {
    const h = resolveOpsLicenseHealth({
      now,
      deploymentMode: 'on_prem',
      suspendedAt: '2026-08-01T00:00:00.000Z',
      suspensionReason: 'manual',
      licenseValidUntil: null,
      licenseCheckedAt: '2026-08-02T10:00:00.000Z',
      lastCheckinAt: '2026-08-02T10:00:00.000Z',
      installPhase: 'claimed',
      offlineGraceDays: 7,
    });
    assert.equal(h.primary.kind, 'suspended');
    if (h.primary.kind !== 'suspended') throw new Error('expected suspended');
    assert.equal(h.primary.canResume, true);
    assert.equal(h.primary.observationOnly, false);
    assert.match(h.primary.label, /已暂停/);
  });

  it('primary: past valid_until observation without db suspend', () => {
    const h = resolveOpsLicenseHealth({
      now,
      deploymentMode: 'cloud',
      suspendedAt: null,
      suspensionReason: null,
      licenseValidUntil: '2026-07-01T22:59:59.999Z',
      licenseCheckedAt: null,
      lastCheckinAt: null,
      installPhase: 'none',
      offlineGraceDays: 7,
    });
    assert.equal(h.primary.kind, 'suspended');
    if (h.primary.kind !== 'suspended') throw new Error('expected suspended');
    assert.equal(h.primary.canResume, false);
    assert.equal(h.primary.observationOnly, true);
    assert.match(h.primary.label, /授权到期/);
  });

  it('primary: offline grace exceeded observation', () => {
    const h = resolveOpsLicenseHealth({
      now,
      deploymentMode: 'on_prem',
      suspendedAt: null,
      suspensionReason: null,
      licenseValidUntil: '2026-12-01T22:59:59.999Z',
      licenseCheckedAt: '2026-07-20T10:00:00.000Z',
      lastCheckinAt: '2026-07-20T10:00:00.000Z',
      installPhase: 'claimed',
      offlineGraceDays: 7,
    });
    assert.equal(h.primary.kind, 'suspended');
    if (h.primary.kind !== 'suspended') throw new Error('expected suspended');
    assert.equal(h.primary.observationOnly, true);
    assert.match(h.primary.label, /离线超时/);
    assert.ok(h.lastOnline && h.lastOnline.daysAgo >= 7);
  });

  it('formatOpsPrimaryLabel is sole observation suffix', () => {
    const expired = resolveOpsLicenseHealth({
      now,
      deploymentMode: 'cloud',
      suspendedAt: null,
      suspensionReason: null,
      licenseValidUntil: '2026-07-01T22:59:59.999Z',
      licenseCheckedAt: null,
      lastCheckinAt: null,
      installPhase: 'none',
    });
    assert.equal(expired.primary.kind, 'suspended');
    if (expired.primary.kind !== 'suspended') throw new Error('expected suspended');
    assert.equal(
      formatOpsPrimaryLabel(expired.primary),
      `${expired.primary.label}（观察）`,
    );
    assert.equal(isOpsPrimarySuspended(expired), true);

    const open = resolveOpsLicenseHealth({
      now,
      deploymentMode: 'cloud',
      suspendedAt: null,
      suspensionReason: null,
      licenseValidUntil: '2026-12-01T22:59:59.999Z',
      licenseCheckedAt: null,
      lastCheckinAt: null,
      installPhase: 'none',
    });
    assert.equal(formatOpsPrimaryLabel(open.primary), BUSINESS_STATUS_LABEL.open);
    assert.equal(isOpsPrimarySuspended(open), false);
    assert.equal(isOpsRestaurantDeletable(open), false);
  });

  it('deletable sole gate: open blocked; suspended and install allowed', () => {
    const suspended = resolveOpsLicenseHealth({
      now,
      deploymentMode: 'cloud',
      suspendedAt: '2026-08-01T00:00:00.000Z',
      suspensionReason: 'manual',
      licenseValidUntil: null,
      licenseCheckedAt: null,
      lastCheckinAt: null,
      installPhase: 'none',
    });
    assert.equal(isOpsRestaurantDeletable(suspended), true);

    const install = resolveOpsLicenseHealth({
      now,
      deploymentMode: 'on_prem',
      suspendedAt: null,
      suspensionReason: null,
      licenseValidUntil: null,
      licenseCheckedAt: null,
      lastCheckinAt: null,
      installPhase: 'pending',
      offlineGraceDays: 7,
    });
    assert.equal(isOpsRestaurantDeletable(install), true);
  });
});
