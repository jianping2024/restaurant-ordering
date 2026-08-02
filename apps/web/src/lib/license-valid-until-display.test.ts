import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LICENSE_RENEWAL_SOON_DAYS,
  LICENSE_RENEWAL_URGENT_DAYS,
  formatLicenseValidUntilYmd,
  licenseValidUntilUrgency,
  lisbonCalendarDaysBetween,
  resolveLicenseValidUntilDisplay,
} from './license-valid-until-display';

describe('license-valid-until-display', () => {
  it('maps day thresholds to urgency', () => {
    assert.equal(licenseValidUntilUrgency(LICENSE_RENEWAL_SOON_DAYS + 1), 'normal');
    assert.equal(licenseValidUntilUrgency(LICENSE_RENEWAL_SOON_DAYS), 'soon');
    assert.equal(licenseValidUntilUrgency(LICENSE_RENEWAL_URGENT_DAYS + 1), 'soon');
    assert.equal(licenseValidUntilUrgency(LICENSE_RENEWAL_URGENT_DAYS), 'urgent');
    assert.equal(licenseValidUntilUrgency(0), 'urgent');
    assert.equal(licenseValidUntilUrgency(-3), 'urgent');
  });

  it('computes Lisbon calendar day deltas', () => {
    assert.equal(lisbonCalendarDaysBetween('2026-08-02', '2026-09-01'), 30);
    assert.equal(lisbonCalendarDaysBetween('2026-08-02', '2026-08-02'), 0);
    assert.equal(lisbonCalendarDaysBetween('2026-08-02', '2026-08-01'), -1);
  });

  it('hides null / invalid clocks', () => {
    assert.equal(resolveLicenseValidUntilDisplay(null), null);
    assert.equal(resolveLicenseValidUntilDisplay(undefined), null);
    assert.equal(resolveLicenseValidUntilDisplay('not-a-date'), null);
  });

  it('resolves urgency from Lisbon end-of-day ISO', () => {
    // 2026-09-01 Lisbon EOD ≈ still calendar day 2026-09-01
    const iso = '2026-09-01T22:59:59.999Z';
    const now = new Date('2026-08-02T12:00:00.000Z');
    const display = resolveLicenseValidUntilDisplay(iso, now);
    assert.ok(display);
    assert.equal(display.ymd, '2026-09-01');
    assert.equal(display.daysRemaining, 30);
    assert.equal(display.urgency, 'soon');
  });

  it('formats YMD in locale without shifting the civil day', () => {
    const formatted = formatLicenseValidUntilYmd('2026-09-01', 'en-GB');
    assert.match(formatted, /2026/);
    assert.match(formatted, /1|01|Sep/i);
  });
});
