import type { AnalyticsRange } from '@/lib/analytics/analytics.types';
import { calendarDateInTimezone } from '@/lib/lisbon-calendar';

/** Short TTL: repeated owner views within the Lisbon day reuse one overview. */
export const VALUE_OVERVIEW_REVALIDATE_SECONDS = 120;

export function valueOverviewCacheTag(restaurantId: string): string {
  return `value-overview:${restaurantId}`;
}

/** Cache partition: restaurant + range + Lisbon business day. */
export function valueOverviewBusinessDay(now: Date = new Date()): string {
  return calendarDateInTimezone(now);
}

export type ValueOverviewCacheKeyParts = {
  restaurantId: string;
  range: AnalyticsRange;
  businessDay: string;
};

export function valueOverviewCacheKeyParts(
  restaurantId: string,
  range: AnalyticsRange,
  now: Date = new Date(),
): ValueOverviewCacheKeyParts {
  return {
    restaurantId,
    range,
    businessDay: valueOverviewBusinessDay(now),
  };
}
