import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LICENSE_CALENDAR_TIMEZONE,
  addLisbonCalendarPeriod,
  isLicenseCalendarDate,
  licenseValidUntilEndOfLisbonDay,
  lisbonCalendarDateFromInstant,
  resolveLicenseCalendarDate,
  todayLisbonCalendarDate,
} from './license-calendar';
import { extendLicenseValidUntil } from './restaurant-suspension';

describe('license calendar (Europe/Lisbon)', () => {
  it('exposes Lisbon as the sole calendar timezone', () => {
    assert.equal(LICENSE_CALENDAR_TIMEZONE, 'Europe/Lisbon');
  });

  it('validates real YYYY-MM-DD only', () => {
    assert.equal(isLicenseCalendarDate('2026-07-30'), true);
    assert.equal(isLicenseCalendarDate('2026-02-30'), false);
    assert.equal(isLicenseCalendarDate('2026-7-30'), false);
    assert.equal(isLicenseCalendarDate('2026-07-30T23:59:59.999Z'), false);
  });

  it('maps summer and winter end-of-day to UTC', () => {
    // WEST (UTC+1): 23:59:59.999 Lisbon → 22:59:59.999Z
    assert.equal(licenseValidUntilEndOfLisbonDay('2026-07-30'), '2026-07-30T22:59:59.999Z');
    // WET (UTC+0): 23:59:59.999 Lisbon → 23:59:59.999Z
    assert.equal(licenseValidUntilEndOfLisbonDay('2026-01-15'), '2026-01-15T23:59:59.999Z');
  });

  it('round-trips Lisbon civil date from end-of-day instant', () => {
    const iso = licenseValidUntilEndOfLisbonDay('2026-07-30');
    assert.equal(lisbonCalendarDateFromInstant(new Date(iso)), '2026-07-30');
  });

  it('rejects dates before Lisbon today', () => {
    const now = new Date('2026-07-30T12:00:00.000Z');
    assert.equal(todayLisbonCalendarDate(now), '2026-07-30');
    assert.deepEqual(resolveLicenseCalendarDate('2026-07-29', now), {
      ok: false,
      error: 'license_date_before_today',
    });
    assert.deepEqual(resolveLicenseCalendarDate('2026-07-30', now), {
      ok: true,
      ymd: '2026-07-30',
      licenseValidUntil: '2026-07-30T22:59:59.999Z',
    });
  });

  it('adds calendar periods on YMD', () => {
    assert.equal(addLisbonCalendarPeriod('2026-07-30', '1d'), '2026-07-31');
    assert.equal(addLisbonCalendarPeriod('2026-07-30', '1m'), '2026-08-30');
    assert.equal(addLisbonCalendarPeriod('2026-07-30', '1y'), '2027-07-30');
  });
});

describe('extendLicenseValidUntil', () => {
  it('extends from max(now, current) to Lisbon end-of-day', () => {
    const now = new Date('2026-07-30T00:00:00.000Z');
    // Lisbon civil date for that instant is 2026-07-30 (WEST).
    const fromPast = extendLicenseValidUntil('2026-01-01T00:00:00.000Z', now, '1m');
    assert.equal(fromPast, '2026-08-30T22:59:59.999Z');

    const fromFuture = extendLicenseValidUntil('2026-12-01T23:59:59.999Z', now, '1y');
    assert.equal(fromFuture, '2027-12-01T23:59:59.999Z');

    const oneDay = extendLicenseValidUntil('2026-07-30T22:59:59.999Z', now, '1d');
    assert.equal(oneDay, '2026-07-31T22:59:59.999Z');
  });
});
