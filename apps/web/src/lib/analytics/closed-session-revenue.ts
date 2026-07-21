import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClosedSessionRow } from '@/lib/analytics/analytics.types';
import type { AnalyticsQueryError } from '@/lib/analytics/analytics.repository';
import {
  fetchBillSplitsBySessionIds,
  fetchClosedSessionsInWindow,
  fetchOrdersBySessionIds,
  fetchUnpaidForcedCloseSessionIds,
  groupOrdersBySession,
  groupSplitsBySession,
} from '@/lib/analytics/analytics.repository';
import { buildRevenueTrend } from '@/lib/analytics/build-overview';
import { isQualifyingSession, sessionRevenue } from '@/lib/analytics/qualifying';
import { sessionDateKeyFromIso } from '@/lib/lisbon-calendar';
import type { BillSplit, Order } from '@/types';

export type ClosedSessionRevenueBundle = {
  sessions: ClosedSessionRow[];
  ordersBySession: Map<string, Order[]>;
  splitsBySession: Map<string, BillSplit[]>;
  forcedClosedSessionIds: Set<string>;
};

export type ClosedSessionRevenueLoadResult =
  | { ok: true; bundle: ClosedSessionRevenueBundle }
  | AnalyticsQueryError;

export function filterQualifyingClosedSessions(
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

export async function loadClosedSessionRevenueBundle(
  admin: SupabaseClient,
  restaurantId: string,
  startUtc: string,
  endExclusiveUtc: string,
): Promise<ClosedSessionRevenueLoadResult> {
  const sessionsResult = await fetchClosedSessionsInWindow(
    admin,
    restaurantId,
    startUtc,
    endExclusiveUtc,
  );
  if (!sessionsResult.ok) {
    return sessionsResult;
  }

  const sessions = sessionsResult.sessions;
  if (sessions.length === 0) {
    return {
      ok: true,
      bundle: {
        sessions: [],
        ordersBySession: new Map(),
        splitsBySession: new Map(),
        forcedClosedSessionIds: new Set(),
      },
    };
  }

  const sessionIds = sessions.map((session) => session.id);
  const [ordersResult, splitsResult, forcedClosedSessionIds] = await Promise.all([
    fetchOrdersBySessionIds(admin, restaurantId, sessionIds),
    fetchBillSplitsBySessionIds(admin, restaurantId, sessionIds),
    fetchUnpaidForcedCloseSessionIds(admin, restaurantId, sessionIds),
  ]);

  if (!ordersResult.ok) {
    return ordersResult;
  }
  if (!splitsResult.ok) {
    return splitsResult;
  }

  return {
    ok: true,
    bundle: {
      sessions,
      ordersBySession: groupOrdersBySession(ordersResult.rows),
      splitsBySession: groupSplitsBySession(splitsResult.rows),
      forcedClosedSessionIds,
    },
  };
}

export function revenueTrendFromBundle(
  dateKeys: string[],
  bundle: ClosedSessionRevenueBundle,
) {
  const qualifying = filterQualifyingClosedSessions(
    bundle.sessions,
    bundle.ordersBySession,
    bundle.splitsBySession,
  );
  return buildRevenueTrend(
    dateKeys,
    qualifying,
    bundle.ordersBySession,
    bundle.splitsBySession,
    bundle.forcedClosedSessionIds,
  );
}

export function revenueSessionCountForDateKey(
  bundle: ClosedSessionRevenueBundle,
  dateKey: string,
  qualifying: ClosedSessionRow[] = filterQualifyingClosedSessions(
    bundle.sessions,
    bundle.ordersBySession,
    bundle.splitsBySession,
  ),
): number {
  let count = 0;
  for (const session of qualifying) {
    if (bundle.forcedClosedSessionIds.has(session.id)) continue;
    if (!session.closed_at || sessionDateKeyFromIso(session.closed_at) !== dateKey) continue;

    const orders = bundle.ordersBySession.get(session.id) || [];
    const splits = bundle.splitsBySession.get(session.id) || [];
    if (sessionRevenue(orders, splits, true) <= 0) continue;
    count += 1;
  }
  return count;
}

export function todayRevenueFromBundle(
  bundle: ClosedSessionRevenueBundle,
  todayDateKey: string,
): { todayRevenue: number; revenueSessionCount: number } {
  const qualifying = filterQualifyingClosedSessions(
    bundle.sessions,
    bundle.ordersBySession,
    bundle.splitsBySession,
  );
  const trend = buildRevenueTrend(
    [todayDateKey],
    qualifying,
    bundle.ordersBySession,
    bundle.splitsBySession,
    bundle.forcedClosedSessionIds,
  );
  return {
    todayRevenue: trend[0]?.revenue ?? 0,
    revenueSessionCount: revenueSessionCountForDateKey(bundle, todayDateKey, qualifying),
  };
}
