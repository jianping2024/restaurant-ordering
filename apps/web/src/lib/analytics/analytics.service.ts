import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnalyticsRange,
  ValueOverviewResponse,
} from '@/lib/analytics/analytics.types';
import { ANALYTICS_DAILY_SCHEMA_VERSION } from '@/lib/analytics/analytics.types';
import {
  computeRestaurantBusinessDayMetrics,
  emptyTrends,
  ensureSealedHistoricalDays,
  fetchDailyRestaurantStats,
  trendsFromDailyRows,
} from '@/lib/analytics/daily-stats';
import { resolveAnalyticsDateWindow } from '@/lib/analytics/date-window';
import { addCalendarDays } from '@/lib/lisbon-calendar';

export type GetValueOverviewResult =
  | { ok: true; data: ValueOverviewResponse }
  | { ok: false; code: 'query_limit_exceeded' | 'query_failed'; message?: string };

/**
 * Value overview: sealed daily rows for history + live compute for Lisbon today.
 * Missing sealed days read as 0. Top/stock modules removed from this surface.
 */
export async function getValueOverview(
  admin: SupabaseClient,
  restaurantId: string,
  range: AnalyticsRange,
  now: Date = new Date(),
): Promise<GetValueOverviewResult> {
  const window = resolveAnalyticsDateWindow(range, now);
  const historicalEnd =
    window.startDate < window.today
      ? addCalendarDays(window.today, -1)
      : window.startDate;

  await ensureSealedHistoricalDays(admin, restaurantId, window.dateKeys, window.today);

  const sealedResult =
    window.startDate < window.today
      ? await fetchDailyRestaurantStats(
          admin,
          restaurantId,
          window.startDate,
          historicalEnd,
        )
      : { ok: true as const, rows: [] };

  if (!sealedResult.ok) {
    return { ok: false, code: sealedResult.code, message: sealedResult.message };
  }

  const todayLive = await computeRestaurantBusinessDayMetrics(
    admin,
    restaurantId,
    window.today,
  );
  if (!todayLive.ok) {
    return { ok: false, code: todayLive.code, message: todayLive.message };
  }

  const { revenueTrend, customerTrend } = trendsFromDailyRows(
    window.dateKeys,
    sealedResult.rows,
    todayLive.metrics,
    window.today,
  );

  if (
    revenueTrend.every((point) => point.revenue === 0) &&
    customerTrend.every((point) => point.customerCount === 0)
  ) {
    const empty = emptyTrends(window.dateKeys);
    return {
      ok: true,
      data: {
        range,
        schemaVersion: ANALYTICS_DAILY_SCHEMA_VERSION,
        ...empty,
      },
    };
  }

  return {
    ok: true,
    data: {
      range,
      schemaVersion: ANALYTICS_DAILY_SCHEMA_VERSION,
      revenueTrend,
      customerTrend,
    },
  };
}
