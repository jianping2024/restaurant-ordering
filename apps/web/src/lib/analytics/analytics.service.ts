import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregateMenuItemsFromOrders, rankMenuItemAggs } from '@/lib/analytics/aggregate-items';
import type {
  AnalyticsRange,
  ClosedSessionRow,
  ValueOverviewResponse,
} from '@/lib/analytics/analytics.types';
import { STOCK_REFERENCE_DISCLAIMER_ZH } from '@/lib/analytics/analytics.types';
import {
  fetchMenuCategoriesByItemIds,
} from '@/lib/analytics/analytics.repository';
import {
  filterQualifyingClosedSessions,
  loadClosedSessionRevenueBundle,
  revenueTrendFromBundle,
} from '@/lib/analytics/closed-session-revenue';
import {
  buildCustomerTrend,
  mapStockReferenceItems,
  mapTopConsumedItems,
} from '@/lib/analytics/build-overview';
import { resolveAnalyticsDateWindow } from '@/lib/analytics/date-window';
import { isIsoInWindow } from '@/lib/lisbon-calendar';
import type { Order } from '@/types';

export type GetValueOverviewResult =
  | { ok: true; data: ValueOverviewResponse }
  | { ok: false; code: 'query_limit_exceeded' | 'query_failed'; message?: string };

function collectOrdersForSessions(
  sessions: ClosedSessionRow[],
  ordersBySession: Map<string, Order[]>,
): Order[] {
  const orders: Order[] = [];
  for (const session of sessions) {
    const list = ordersBySession.get(session.id);
    if (list) orders.push(...list);
  }
  return orders;
}

function emptyOverview(range: AnalyticsRange, dateKeys: string[]): ValueOverviewResponse {
  return {
    range,
    revenueTrend: dateKeys.map((date) => ({ date, revenue: 0 })),
    customerTrend: dateKeys.map((date) => ({
      date,
      customerCount: 0,
      adultCount: 0,
      childCount: 0,
    })),
    topConsumedItems: [],
    stockReferenceItems: [],
    disclaimer: STOCK_REFERENCE_DISCLAIMER_ZH,
  };
}

export async function getValueOverview(
  admin: SupabaseClient,
  restaurantId: string,
  range: AnalyticsRange,
  now: Date = new Date(),
): Promise<GetValueOverviewResult> {
  const window = resolveAnalyticsDateWindow(range, now);
  const window7 = resolveAnalyticsDateWindow('7d', now);

  const bundleResult = await loadClosedSessionRevenueBundle(
    admin,
    restaurantId,
    window.startUtc,
    window.endExclusiveUtc,
  );
  if (!bundleResult.ok) {
    return { ok: false, code: bundleResult.code, message: bundleResult.message };
  }

  const { bundle } = bundleResult;
  if (bundle.sessions.length === 0) {
    return { ok: true, data: emptyOverview(range, window.dateKeys) };
  }

  const qualifying = filterQualifyingClosedSessions(
    bundle.sessions,
    bundle.ordersBySession,
    bundle.splitsBySession,
  );

  const qualifying7d = qualifying.filter(
    (session) => session.closed_at && isIsoInWindow(session.closed_at, window7.startUtc, window7.endExclusiveUtc),
  );

  const revenueTrend = revenueTrendFromBundle(window.dateKeys, bundle);
  const customerTrend = buildCustomerTrend(window.dateKeys, qualifying, bundle.ordersBySession);

  const rangeOrders = collectOrdersForSessions(qualifying, bundle.ordersBySession);
  const stockOrders = collectOrdersForSessions(qualifying7d, bundle.ordersBySession);

  const rangeRanked = rankMenuItemAggs(aggregateMenuItemsFromOrders(rangeOrders), 10);
  const stockRanked = rankMenuItemAggs(aggregateMenuItemsFromOrders(stockOrders), 5);

  const itemIds = Array.from(new Set([...rangeRanked, ...stockRanked].map((row) => row.itemId)));
  const categories = await fetchMenuCategoriesByItemIds(admin, restaurantId, itemIds);

  return {
    ok: true,
    data: {
      range,
      revenueTrend,
      customerTrend,
      topConsumedItems: mapTopConsumedItems(rangeRanked, categories),
      stockReferenceItems: mapStockReferenceItems(stockRanked, categories),
      disclaimer: STOCK_REFERENCE_DISCLAIMER_ZH,
    },
  };
}
