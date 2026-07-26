import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnalyticsRange,
  ValueOverviewResponse,
} from '@/lib/analytics/analytics.types';
import { ANALYTICS_DAILY_SCHEMA_VERSION } from '@/lib/analytics/analytics.types';
import {
  buildGrainTrends,
  computeRestaurantBusinessDayMetrics,
  emptyTrends,
  ensureSealedClosedBusinessDays,
  fetchDailyRestaurantStats,
} from '@/lib/analytics/daily-stats';
import { resolveAnalyticsDateWindow } from '@/lib/analytics/date-window';
import { addCalendarDays } from '@/lib/lisbon-calendar';

export type GetValueOverviewResult =
  | { ok: true; data: ValueOverviewResponse }
  | { ok: false; code: 'query_limit_exceeded' | 'query_failed'; message?: string };

/** Lazy-seal only recent closed days; older history is assumed already sealed from prior visits. */
export const ANALYTICS_SEAL_LOOKBACK_DAYS = 7;

/**
 * Value overview by grain (day/week/month/quarter).
 * Seals only Lisbon days that have closed sessions within the last 7 days;
 * never empty-calendar seals. Zero-activity days are not written.
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

  const sealStartCandidate = addCalendarDays(window.today, -ANALYTICS_SEAL_LOOKBACK_DAYS);
  const sealStart =
    sealStartCandidate > window.startDate ? sealStartCandidate : window.startDate;

  const sealedEnsure = await ensureSealedClosedBusinessDays(
    admin,
    restaurantId,
    sealStart,
    historicalEnd,
    window.today,
  );
  if (!sealedEnsure.ok) {
    return { ok: false, code: sealedEnsure.code, message: sealedEnsure.message };
  }

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

  const { revenueTrend, customerTrend } = buildGrainTrends(
    range,
    window.dateKeys,
    sealedResult.rows,
    todayLive.metrics,
    window.today,
  );

  if (
    revenueTrend.length === 0 ||
    (range !== 'day' &&
      revenueTrend.every((point) => point.revenue === 0) &&
      customerTrend.every((point) => point.customerCount === 0))
  ) {
    return {
      ok: true,
      data: {
        range,
        schemaVersion: ANALYTICS_DAILY_SCHEMA_VERSION,
        ...emptyTrends(),
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
