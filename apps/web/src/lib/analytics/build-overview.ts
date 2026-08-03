import { auditMoney } from '@/lib/audit/money';
import type {
  AnalyticsItemOrder,
  AnalyticsRevenueOrder,
} from '@/lib/analytics/analytics.repository';
import type {
  ClosedSessionRow,
  CustomerTrendPoint,
  RevenueTrendPoint,
} from '@/lib/analytics/analytics.types';
import { sessionDateKeyFromIso } from '@/lib/lisbon-calendar';
import { sessionGuestCounts, sessionRevenue } from '@/lib/analytics/qualifying';
import type { BillSplit } from '@/types';

export function buildRevenueTrend(
  dateKeys: string[],
  sessions: ClosedSessionRow[],
  ordersBySession: Map<string, AnalyticsRevenueOrder[]>,
  splitsBySession: Map<string, BillSplit[]>,
  forcedClosedSessionIds: Set<string> = new Set(),
): RevenueTrendPoint[] {
  const daily = new Map<string, number>();
  for (const key of dateKeys) daily.set(key, 0);

  for (const session of sessions) {
    if (!session.closed_at) continue;
    if (forcedClosedSessionIds.has(session.id)) continue;

    const bucket = sessionDateKeyFromIso(session.closed_at);
    const orders = ordersBySession.get(session.id) || [];
    const splits = splitsBySession.get(session.id) || [];
    const revenue = sessionRevenue(
      orders,
      splits,
      true,
      session.settled_payable_amount,
    );
    daily.set(bucket, auditMoney((daily.get(bucket) || 0) + revenue));
  }

  return dateKeys.map((date) => ({ date, revenue: daily.get(date) || 0 }));
}

export function buildCustomerTrend(
  dateKeys: string[],
  sessions: ClosedSessionRow[],
  ordersBySession: Map<string, AnalyticsItemOrder[]>,
): CustomerTrendPoint[] {
  const adultsByDay = new Map<string, number>();
  const childrenByDay = new Map<string, number>();
  for (const key of dateKeys) {
    adultsByDay.set(key, 0);
    childrenByDay.set(key, 0);
  }

  for (const session of sessions) {
    if (!session.closed_at) continue;
    const bucket = sessionDateKeyFromIso(session.closed_at);
    const orders = ordersBySession.get(session.id) || [];
    const { adults, children } = sessionGuestCounts(orders);
    adultsByDay.set(bucket, (adultsByDay.get(bucket) || 0) + adults);
    childrenByDay.set(bucket, (childrenByDay.get(bucket) || 0) + children);
  }

  return dateKeys.map((date) => {
    const adultCount = adultsByDay.get(date) || 0;
    const childCount = childrenByDay.get(date) || 0;
    return {
      date,
      adultCount,
      childCount,
      customerCount: adultCount + childCount,
    };
  });
}
