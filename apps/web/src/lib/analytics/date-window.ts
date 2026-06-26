import type { AnalyticsRange, AnalyticsDateWindow } from '@/lib/analytics/analytics.types';
import {
  addCalendarDays,
  buildDateKeySeries,
  calendarDateInTimezone,
  lisbonDayStartUtcIso,
} from '@/lib/lisbon-calendar';

export function parseAnalyticsRange(raw: string | null): AnalyticsRange | null {
  if (!raw || raw === '7d') return '7d';
  if (raw === '30d') return '30d';
  return null;
}

export function resolveAnalyticsDateWindow(
  range: AnalyticsRange,
  now: Date = new Date(),
): AnalyticsDateWindow {
  const today = calendarDateInTimezone(now);
  const daySpan = range === '7d' ? 6 : 29;
  const startDate = addCalendarDays(today, -daySpan);
  const endDate = today;

  return {
    range,
    today,
    startDate,
    endDate,
    startUtc: lisbonDayStartUtcIso(startDate),
    endExclusiveUtc: lisbonDayStartUtcIso(addCalendarDays(endDate, 1)),
    dateKeys: buildDateKeySeries(startDate, endDate),
  };
}
