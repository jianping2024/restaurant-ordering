import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addCalendarDays, calendarDateInTimezone } from '@/lib/lisbon-calendar';
import { parseDashboardRevenueIntervalDates, DASHBOARD_REVENUE_INTERVAL_MAX_MONTHS } from './revenue-interval';

function monthStart(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

function shiftMonthStart(dateStr: string, deltaMonths: number): string {
  const [yearStr, monthStr] = dateStr.slice(0, 7).split('-');
  const year = Number(yearStr);
  const monthZero = Number(monthStr) - 1;
  const idx = year * 12 + monthZero + deltaMonths;
  const nextYear = Math.floor(idx / 12);
  const nextMonthZero = ((idx % 12) + 12) % 12;
  const nextMonth = nextMonthZero + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

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

  it('rejects when range exceeds max months (inclusive)', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    const today = calendarDateInTimezone(now);
    const tooEarly = shiftMonthStart(monthStart(today), -DASHBOARD_REVENUE_INTERVAL_MAX_MONTHS);
    const res = parseDashboardRevenueIntervalDates({
      startDate: tooEarly,
      endDate: today,
      now,
    });
    assert.equal(res.ok, false);
  });

  it('accepts max-months inclusive range', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    const today = calendarDateInTimezone(now);
    const earliest = shiftMonthStart(
      monthStart(today),
      -(DASHBOARD_REVENUE_INTERVAL_MAX_MONTHS - 1),
    );
    const res = parseDashboardRevenueIntervalDates({
      startDate: earliest,
      endDate: today,
      now,
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.dateKeys[0], earliest);
      assert.equal(res.dateKeys.at(-1), today);
    }
  });
});

