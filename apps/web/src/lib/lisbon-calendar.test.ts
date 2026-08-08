import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addCalendarDays,
  calendarDateInTimezone,
  lisbonDayStartUtcIso,
  lisbonLocalClockUtcIso,
} from './lisbon-calendar';
import { getZonedCalendarParts } from './zoned-time';
import { DASHBOARD_DISPLAY_TZ } from './format-dashboard-date';

describe('lisbonLocalClockUtcIso', () => {
  it('lands on Lisbon 17:00 for a winter date (WET)', () => {
    const iso = lisbonLocalClockUtcIso('2026-01-15', '17:00');
    const parts = getZonedCalendarParts(new Date(iso), DASHBOARD_DISPLAY_TZ);
    assert.equal(parts.dateKey, '2026-01-15');
    assert.equal(parts.hour, 17);
    assert.equal(parts.minute, 0);
    assert.equal(iso, '2026-01-15T17:00:00.000Z');
  });

  it('lands on Lisbon 17:00 for a summer date (WEST / UTC+1)', () => {
    const iso = lisbonLocalClockUtcIso('2026-07-15', '17:00');
    const parts = getZonedCalendarParts(new Date(iso), DASHBOARD_DISPLAY_TZ);
    assert.equal(parts.dateKey, '2026-07-15');
    assert.equal(parts.hour, 17);
    assert.equal(parts.minute, 0);
    assert.equal(iso, '2026-07-15T16:00:00.000Z');
  });

  it('is strictly after day start and before next day start', () => {
    const day = '2026-08-08';
    const start = Date.parse(lisbonDayStartUtcIso(day));
    const cutoff = Date.parse(lisbonLocalClockUtcIso(day, '17:00'));
    const next = Date.parse(lisbonDayStartUtcIso(addCalendarDays(day, 1)));
    assert.ok(cutoff > start);
    assert.ok(cutoff < next);
  });

  it('rejects bad clock strings', () => {
    assert.throws(() => lisbonLocalClockUtcIso('2026-01-15', '17'), /invalid_lisbon_clock/);
    assert.throws(() => lisbonLocalClockUtcIso('2026-01-15', '25:00'), /invalid_lisbon_clock/);
  });

  it('calendarDateInTimezone matches en-CA Lisbon day', () => {
    assert.equal(calendarDateInTimezone(new Date('2026-07-15T16:00:00.000Z')), '2026-07-15');
  });
});
