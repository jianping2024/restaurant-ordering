import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addCalendarDays, calendarDateInTimezone } from '@/lib/lisbon-calendar';
import { parseDashboardRevenueIntervalDates, DASHBOARD_REVENUE_INTERVAL_MAX_DAYS } from './revenue-interval';

describe('parseDashboardRevenueIntervalDates', () => {
  it('accepts single-day range', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    const today = calendarDateInTimezone(now);
    const res = parseDashboardRevenueIntervalDates({
      startDate: today,
      endDate: today,
      now,
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.startDate, today);
      assert.equal(res.endDate, today);
      assert.equal(res.dateKeys.length, 1);
    }
  });

  it('rejects when start > end', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    const today = calendarDateInTimezone(now);
    const res = parseDashboardRevenueIntervalDates({
      startDate: today,
      endDate: addCalendarDays(today, -1),
      now,
    });
    assert.equal(res.ok, false);
  });

  it('rejects when range exceeds max days (inclusive)', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    const today = calendarDateInTimezone(now);
    const tooEarly = addCalendarDays(today, -(DASHBOARD_REVENUE_INTERVAL_MAX_DAYS));
    const res = parseDashboardRevenueIntervalDates({
      startDate: tooEarly,
      endDate: today,
      now,
    });
    assert.equal(res.ok, false);
  });

  it('accepts max-days inclusive range', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    const today = calendarDateInTimezone(now);
    const earliest = addCalendarDays(today, -(DASHBOARD_REVENUE_INTERVAL_MAX_DAYS - 1));
    const res = parseDashboardRevenueIntervalDates({
      startDate: earliest,
      endDate: today,
      now,
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.dateKeys.length, DASHBOARD_REVENUE_INTERVAL_MAX_DAYS);
    }
  });
});

