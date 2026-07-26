import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  type AnalyticsDateWindow,
} from '@/lib/analytics/analytics.types';
import {
  addCalendarDays,
  buildDateKeySeries,
  calendarDateInTimezone,
  lisbonDayStartUtcIso,
} from '@/lib/lisbon-calendar';

const ANALYTICS_RANGE_SET = new Set<string>(ANALYTICS_RANGES);

export function parseAnalyticsRange(raw: string | null): AnalyticsRange | null {
  if (!raw) return 'day';
  if (ANALYTICS_RANGE_SET.has(raw)) return raw as AnalyticsRange;
  // Legacy bookmarks during transition
  if (raw === '7d' || raw === '30d') return 'day';
  return null;
}

export type TodayLisbonWindow = {
  today: string;
  startUtc: string;
  endExclusiveUtc: string;
};

/** Lisbon calendar day for dashboard “today” KPIs (orders created_at, closed_at revenue). */
export function resolveTodayLisbonWindow(now: Date = new Date()): TodayLisbonWindow {
  const today = calendarDateInTimezone(now);
  return {
    today,
    startUtc: lisbonDayStartUtcIso(today),
    endExclusiveUtc: lisbonDayStartUtcIso(addCalendarDays(today, 1)),
  };
}

function lisbonYearStart(today: string): string {
  return `${today.slice(0, 4)}-01-01`;
}

/**
 * Resolve the max calendar window used to load/seal source days for a grain.
 * Chart period trimming (first activity) happens after aggregation.
 */
export function resolveAnalyticsDateWindow(
  range: AnalyticsRange,
  now: Date = new Date(),
): AnalyticsDateWindow {
  const today = calendarDateInTimezone(now);
  const endDate = today;

  let startDate: string;
  if (range === 'day') {
    startDate = addCalendarDays(today, -29);
  } else {
    startDate = lisbonYearStart(today);
  }

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
