import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnalyticsDailyRestaurantStatRow,
  AnalyticsRange,
  CustomerTrendPoint,
  RevenueTrendPoint,
} from '@/lib/analytics/analytics.types';
import { ANALYTICS_DAILY_SCHEMA_VERSION } from '@/lib/analytics/analytics.types';
import type { AnalyticsQueryError } from '@/lib/analytics/analytics.repository';
import {
  fetchDistinctClosedBusinessDates,
  fetchItemOrdersBySessionIds,
  groupOrdersBySession,
} from '@/lib/analytics/analytics.repository';
import {
  filterQualifyingClosedSessions,
  loadClosedSessionRevenueBundle,
  revenueTrendFromBundle,
} from '@/lib/analytics/closed-session-revenue';
import { buildCustomerTrend } from '@/lib/analytics/build-overview';
import {
  aggregateDailyPointsByGrain,
  hasBusinessActivity,
  toTrendSeries,
  trimLeadingEmptyPeriods,
  type DailyMetricPoint,
} from '@/lib/analytics/period-aggregate';
import { addCalendarDays, lisbonDayStartUtcIso } from '@/lib/lisbon-calendar';

export type DailyStatMetrics = {
  businessDate: string;
  revenue: number;
  adultCount: number;
  childCount: number;
  customerCount: number;
  qualifyingSessionCount: number;
};

function metricsFromTrends(
  businessDate: string,
  revenueTrend: RevenueTrendPoint[],
  customerTrend: CustomerTrendPoint[],
  qualifyingSessionCount: number,
): DailyStatMetrics {
  const revenue = revenueTrend[0]?.revenue ?? 0;
  const customer = customerTrend[0];
  return {
    businessDate,
    revenue,
    adultCount: customer?.adultCount ?? 0,
    childCount: customer?.childCount ?? 0,
    customerCount: customer?.customerCount ?? 0,
    qualifyingSessionCount,
  };
}

/** Compute one Lisbon business day from source tables (same qualifying/revenue/guest rules). */
export async function computeRestaurantBusinessDayMetrics(
  admin: SupabaseClient,
  restaurantId: string,
  businessDate: string,
): Promise<{ ok: true; metrics: DailyStatMetrics } | AnalyticsQueryError> {
  const startUtc = lisbonDayStartUtcIso(businessDate);
  const endExclusiveUtc = lisbonDayStartUtcIso(addCalendarDays(businessDate, 1));
  const dateKeys = [businessDate];

  const bundleResult = await loadClosedSessionRevenueBundle(
    admin,
    restaurantId,
    startUtc,
    endExclusiveUtc,
  );
  if (!bundleResult.ok) {
    return bundleResult;
  }

  const { bundle } = bundleResult;
  const revenueTrend = revenueTrendFromBundle(dateKeys, bundle);
  const qualifying = filterQualifyingClosedSessions(
    bundle.sessions,
    bundle.ordersBySession,
    bundle.splitsBySession,
  );

  if (qualifying.length === 0) {
    return {
      ok: true,
      metrics: metricsFromTrends(businessDate, revenueTrend, [], 0),
    };
  }

  const itemOrdersResult = await fetchItemOrdersBySessionIds(
    admin,
    restaurantId,
    qualifying.map((session) => session.id),
  );
  if (!itemOrdersResult.ok) {
    return itemOrdersResult;
  }

  const customerTrend = buildCustomerTrend(
    dateKeys,
    qualifying,
    groupOrdersBySession(itemOrdersResult.rows),
  );

  return {
    ok: true,
    metrics: metricsFromTrends(businessDate, revenueTrend, customerTrend, qualifying.length),
  };
}

export async function upsertDailyRestaurantStat(
  admin: SupabaseClient,
  restaurantId: string,
  metrics: DailyStatMetrics,
): Promise<{ ok: true } | AnalyticsQueryError> {
  const nowIso = new Date().toISOString();
  const row = {
    restaurant_id: restaurantId,
    business_date: metrics.businessDate,
    revenue: metrics.revenue,
    adult_count: metrics.adultCount,
    child_count: metrics.childCount,
    customer_count: metrics.customerCount,
    qualifying_session_count: metrics.qualifyingSessionCount,
    sealed_at: nowIso,
    computed_at: nowIso,
  };

  const { error } = await admin.from('analytics_daily_restaurant_stats').upsert(row, {
    onConflict: 'restaurant_id,business_date',
  });

  if (error) {
    return { ok: false, code: 'query_failed', message: error.message };
  }
  return { ok: true };
}

/**
 * Seal one Lisbon day that had closed sessions.
 * No-op insert when metrics have no business activity (hard rule: no zero rows).
 */
export async function sealRestaurantBusinessDay(
  admin: SupabaseClient,
  restaurantId: string,
  businessDate: string,
): Promise<{ ok: true; metrics: DailyStatMetrics; written: boolean } | AnalyticsQueryError> {
  const computed = await computeRestaurantBusinessDayMetrics(admin, restaurantId, businessDate);
  if (!computed.ok) {
    return computed;
  }
  if (
    !hasBusinessActivity({
      revenue: computed.metrics.revenue,
      customerCount: computed.metrics.customerCount,
    })
  ) {
    return { ok: true, metrics: computed.metrics, written: false };
  }
  const written = await upsertDailyRestaurantStat(admin, restaurantId, computed.metrics);
  if (!written.ok) {
    return written;
  }
  return { ok: true, metrics: computed.metrics, written: true };
}

export async function fetchDailyRestaurantStats(
  admin: SupabaseClient,
  restaurantId: string,
  startDate: string,
  endDateInclusive: string,
): Promise<{ ok: true; rows: AnalyticsDailyRestaurantStatRow[] } | AnalyticsQueryError> {
  const { data, error } = await admin
    .from('analytics_daily_restaurant_stats')
    .select(
      'restaurant_id, business_date, revenue, adult_count, child_count, customer_count, qualifying_session_count, sealed_at, computed_at',
    )
    .eq('restaurant_id', restaurantId)
    .gte('business_date', startDate)
    .lte('business_date', endDateInclusive)
    .order('business_date', { ascending: true });

  if (error) {
    return { ok: false, code: 'query_failed', message: error.message };
  }

  return { ok: true, rows: (data || []) as AnalyticsDailyRestaurantStatRow[] };
}

/**
 * Seal only Lisbon days that have closed sessions in [startDate, endDate] ∩ before today.
 * Never iterates empty calendar days.
 */
export async function ensureSealedClosedBusinessDays(
  admin: SupabaseClient,
  restaurantId: string,
  startDate: string,
  endDateInclusive: string,
  today: string,
): Promise<{ ok: true } | AnalyticsQueryError> {
  const sealEnd = endDateInclusive < today ? endDateInclusive : addCalendarDays(today, -1);
  if (startDate > sealEnd) {
    return { ok: true };
  }

  const startUtc = lisbonDayStartUtcIso(startDate);
  const endExclusiveUtc = lisbonDayStartUtcIso(addCalendarDays(sealEnd, 1));
  const closedDates = await fetchDistinctClosedBusinessDates(
    admin,
    restaurantId,
    startUtc,
    endExclusiveUtc,
  );
  if (!closedDates.ok) {
    return closedDates;
  }

  const existing = await fetchDailyRestaurantStats(admin, restaurantId, startDate, sealEnd);
  if (!existing.ok) {
    return existing;
  }
  const have = new Set(existing.rows.map((row) => row.business_date));

  const toSeal = closedDates.dates.filter(
    (day) => day >= startDate && day <= sealEnd && day < today && !have.has(day),
  );

  const concurrency = 4;
  for (let i = 0; i < toSeal.length; i += concurrency) {
    const batch = toSeal.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((day) => sealRestaurantBusinessDay(admin, restaurantId, day)),
    );
    for (const result of results) {
      if (!result.ok) {
        return result;
      }
    }
  }

  return { ok: true };
}

export function dailyPointsFromRows(
  dateKeys: string[],
  rows: AnalyticsDailyRestaurantStatRow[],
  todayLive: DailyStatMetrics | null,
  today: string,
): DailyMetricPoint[] {
  const byDate = new Map(rows.map((row) => [row.business_date, row]));
  const points: DailyMetricPoint[] = [];

  for (const date of dateKeys) {
    if (date === today && todayLive) {
      points.push({
        date,
        revenue: todayLive.revenue,
        adultCount: todayLive.adultCount,
        childCount: todayLive.childCount,
        customerCount: todayLive.customerCount,
      });
      continue;
    }

    const row = byDate.get(date);
    const adultCount = row ? Number(row.adult_count) || 0 : 0;
    const childCount = row ? Number(row.child_count) || 0 : 0;
    points.push({
      date,
      revenue: row ? Number(row.revenue) || 0 : 0,
      adultCount,
      childCount,
      customerCount: row ? Number(row.customer_count) || adultCount + childCount : 0,
    });
  }

  return points;
}

export function buildGrainTrends(
  grain: AnalyticsRange,
  dateKeys: string[],
  rows: AnalyticsDailyRestaurantStatRow[],
  todayLive: DailyStatMetrics | null,
  today: string,
): { revenueTrend: RevenueTrendPoint[]; customerTrend: CustomerTrendPoint[] } {
  const daily = dailyPointsFromRows(dateKeys, rows, todayLive, today);
  const aggregated = aggregateDailyPointsByGrain(daily, grain);
  const trimmed = trimLeadingEmptyPeriods(aggregated, grain);
  return toTrendSeries(trimmed);
}

export function emptyTrends(): {
  revenueTrend: RevenueTrendPoint[];
  customerTrend: CustomerTrendPoint[];
} {
  return { revenueTrend: [], customerTrend: [] };
}

export { ANALYTICS_DAILY_SCHEMA_VERSION };
