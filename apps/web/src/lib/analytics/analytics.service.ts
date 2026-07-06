import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregateMenuItemsFromOrders, rankMenuItemAggs } from '@/lib/analytics/aggregate-items';
import type {
  AnalyticsRange,
  ClosedSessionRow,
  ValueOverviewResponse,
} from '@/lib/analytics/analytics.types';
import { STOCK_REFERENCE_DISCLAIMER_ZH } from '@/lib/analytics/analytics.types';
import {
  fetchBillSplitsBySessionIds,
  fetchClosedSessionsInWindow,
  fetchMenuCategoriesByItemIds,
  fetchOrdersBySessionIds,
  groupOrdersBySession,
  groupSplitsBySession,
} from '@/lib/analytics/analytics.repository';
import {
  buildCustomerTrend,
  buildRevenueTrend,
  mapStockReferenceItems,
  mapTopConsumedItems,
} from '@/lib/analytics/build-overview';
import { resolveAnalyticsDateWindow } from '@/lib/analytics/date-window';
import { isQualifyingSession } from '@/lib/analytics/qualifying';
import { isIsoInWindow } from '@/lib/lisbon-calendar';
import type { BillSplit, Order } from '@/types';

export type GetValueOverviewResult =
  | { ok: true; data: ValueOverviewResponse }
  | { ok: false; code: 'query_limit_exceeded' | 'query_failed'; message?: string };

function filterQualifyingSessions(
  sessions: ClosedSessionRow[],
  ordersBySession: Map<string, Order[]>,
  splitsBySession: Map<string, BillSplit[]>,
): ClosedSessionRow[] {
  return sessions.filter((session) => {
    const orders = ordersBySession.get(session.id) || [];
    const splits = splitsBySession.get(session.id) || [];
    return isQualifyingSession(orders, splits);
  });
}

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

  const sessionsResult = await fetchClosedSessionsInWindow(
    admin,
    restaurantId,
    window.startUtc,
    window.endExclusiveUtc,
  );
  if (!sessionsResult.ok) {
    return { ok: false, code: sessionsResult.code, message: sessionsResult.message };
  }

  const allSessions = sessionsResult.sessions;
  if (allSessions.length === 0) {
    return { ok: true, data: emptyOverview(range, window.dateKeys) };
  }

  const sessionIds = allSessions.map((session) => session.id);
  const [ordersResult, splitsResult] = await Promise.all([
    fetchOrdersBySessionIds(admin, restaurantId, sessionIds),
    fetchBillSplitsBySessionIds(admin, restaurantId, sessionIds),
  ]);

  if (!ordersResult.ok) {
    return { ok: false, code: ordersResult.code, message: ordersResult.message };
  }
  if (!splitsResult.ok) {
    return { ok: false, code: splitsResult.code, message: splitsResult.message };
  }

  const ordersBySession = groupOrdersBySession(ordersResult.rows);
  const splitsBySession = groupSplitsBySession(splitsResult.rows);
  const qualifying = filterQualifyingSessions(allSessions, ordersBySession, splitsBySession);

  const qualifyingInRange = qualifying.filter(
    (session) => session.closed_at && isIsoInWindow(session.closed_at, window.startUtc, window.endExclusiveUtc),
  );
  const qualifying7d = qualifying.filter(
    (session) => session.closed_at && isIsoInWindow(session.closed_at, window7.startUtc, window7.endExclusiveUtc),
  );

  const revenueTrend = buildRevenueTrend(window.dateKeys, qualifyingInRange, ordersBySession, splitsBySession);
  const customerTrend = buildCustomerTrend(window.dateKeys, qualifyingInRange, ordersBySession);

  const rangeOrders = collectOrdersForSessions(qualifyingInRange, ordersBySession);
  const stockOrders = collectOrdersForSessions(qualifying7d, ordersBySession);

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
