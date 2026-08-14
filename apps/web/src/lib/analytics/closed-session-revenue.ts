import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ANALYTICS_MAX_CLOSED_SESSIONS,
  type ClosedSessionRow,
} from '@/lib/analytics/analytics.types';
import type {
  AnalyticsItemOrder,
  AnalyticsQueryError,
  AnalyticsRevenueOrder,
} from '@/lib/analytics/analytics.repository';
import {
  fetchBillSplitsBySessionIds,
  fetchClosedSessionsInWindow,
  fetchRevenueOrdersBySessionIds,
  fetchUnpaidForcedCloseSessionIds,
  groupOrdersBySession,
  groupSplitsBySession,
} from '@/lib/analytics/analytics.repository';
import { buildRevenueTrend } from '@/lib/analytics/build-overview';
import { isQualifyingSession, sessionGuestCounts, sessionRevenue } from '@/lib/analytics/qualifying';
import type { BuffetGuestHeadcount } from '@/lib/buffet-order';
import { sessionDateKeyFromIso } from '@/lib/lisbon-calendar';
import { isOperationalCloseReason } from '@/lib/table-session/operational-close-reasons';
import type { BillSplit } from '@/types';

export type ClosedSessionRevenueBundle = {
  sessions: ClosedSessionRow[];
  ordersBySession: Map<string, AnalyticsRevenueOrder[]>;
  splitsBySession: Map<string, BillSplit[]>;
  forcedClosedSessionIds: Set<string>;
};

export type ClosedSessionRevenueLoadResult =
  | { ok: true; bundle: ClosedSessionRevenueBundle }
  | AnalyticsQueryError;

type RevenueBundleRpcPayload = {
  ok?: boolean;
  code?: string;
  sessions?: ClosedSessionRow[];
  orders?: AnalyticsRevenueOrder[];
  splits?: BillSplit[];
  unpaid_session_ids?: Array<string | null>;
};

/**
 * One-RTT revenue raw materials for a Lisbon window (dashboard overview primary).
 * Qualifying / forced-close math stays in todayRevenueFromBundle — not duplicated in SQL.
 */
export async function loadClosedSessionRevenueBundleRpc(
  admin: SupabaseClient,
  restaurantId: string,
  startUtc: string,
  endExclusiveUtc: string,
): Promise<ClosedSessionRevenueLoadResult> {
  const { data, error } = await admin.rpc('dashboard_overview_revenue_bundle', {
    p_restaurant_id: restaurantId,
    p_start_utc: startUtc,
    p_end_exclusive_utc: endExclusiveUtc,
    p_max_sessions: ANALYTICS_MAX_CLOSED_SESSIONS,
  });

  if (error) {
    return { ok: false, code: 'query_failed', message: error.message };
  }

  const payload = (data || {}) as RevenueBundleRpcPayload;
  if (payload.ok === false) {
    if (payload.code === 'query_limit_exceeded') {
      return { ok: false, code: 'query_limit_exceeded' };
    }
    return { ok: false, code: 'query_failed', message: payload.code || 'rpc_failed' };
  }

  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  const orders = Array.isArray(payload.orders) ? payload.orders : [];
  const splits = Array.isArray(payload.splits) ? payload.splits : [];
  const unpaid = new Set<string>();
  for (const id of payload.unpaid_session_ids || []) {
    if (id) unpaid.add(id);
  }

  return {
    ok: true,
    bundle: assembleClosedSessionRevenueBundle(sessions, orders, splits, unpaid),
  };
}

function assembleClosedSessionRevenueBundle(
  sessions: ClosedSessionRow[],
  orders: AnalyticsRevenueOrder[],
  splits: BillSplit[],
  unpaidAbnormalSessionIds: Set<string>,
): ClosedSessionRevenueBundle {
  return {
    sessions,
    ordersBySession: groupOrdersBySession(orders),
    splitsBySession: groupSplitsBySession(splits),
    forcedClosedSessionIds: mergeForcedCloseSessionIds(sessions, unpaidAbnormalSessionIds),
  };
}

/** UNPAID_TABLE_CLOSED abnormals + operational closed_reason values. */
export function mergeForcedCloseSessionIds(
  sessions: ClosedSessionRow[],
  unpaidAbnormalSessionIds: Set<string>,
): Set<string> {
  const forced = new Set(unpaidAbnormalSessionIds);
  for (const session of sessions) {
    if (isOperationalCloseReason(session.closed_reason)) {
      forced.add(session.id);
    }
  }
  return forced;
}

export function filterQualifyingClosedSessions(
  sessions: ClosedSessionRow[],
  ordersBySession: Map<string, AnalyticsRevenueOrder[]>,
  splitsBySession: Map<string, BillSplit[]>,
): ClosedSessionRow[] {
  return sessions.filter((session) => {
    const orders = ordersBySession.get(session.id) || [];
    const splits = splitsBySession.get(session.id) || [];
    return isQualifyingSession(orders, splits, session.settled_payable_amount);
  });
}

/**
 * Closed-session revenue bundle: sessions + light orders (no items) + splits + forced closes.
 * Use fetchItemOrdersBySessionIds separately when guest/menu aggregation is needed.
 */
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
      bundle: assembleClosedSessionRevenueBundle([], [], [], new Set()),
    };
  }

  const sessionIds = sessions.map((session) => session.id);
  const [ordersResult, splitsResult, unpaidForcedIds] = await Promise.all([
    fetchRevenueOrdersBySessionIds(admin, restaurantId, sessionIds),
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
    bundle: assembleClosedSessionRevenueBundle(
      sessions,
      ordersResult.rows,
      splitsResult.rows,
      unpaidForcedIds,
    ),
  };
}

/**
 * Sole filter for “today tables / today guests”: qualifying · not forced · Lisbon dateKey ·
 * sessionRevenue > 0. Count and guest sum must both iterate this list.
 */
export function todayRevenueSessionIds(
  bundle: ClosedSessionRevenueBundle,
  dateKey: string,
  qualifying: ClosedSessionRow[] = filterQualifyingClosedSessions(
    bundle.sessions,
    bundle.ordersBySession,
    bundle.splitsBySession,
  ),
): string[] {
  const ids: string[] = [];
  for (const session of qualifying) {
    if (bundle.forcedClosedSessionIds.has(session.id)) continue;
    if (!session.closed_at || sessionDateKeyFromIso(session.closed_at) !== dateKey) continue;

    const orders = bundle.ordersBySession.get(session.id) || [];
    const splits = bundle.splitsBySession.get(session.id) || [];
    if (sessionRevenue(orders, splits, true, session.settled_payable_amount) <= 0) continue;
    ids.push(session.id);
  }
  return ids;
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
  return todayRevenueSessionIds(bundle, dateKey, qualifying).length;
}

/** Guest headcount for the same session ids as today table count (needs item-bearing orders). */
export function todayGuestsForRevenueSessions(
  sessionIds: string[],
  itemOrdersBySession: Map<string, AnalyticsItemOrder[]>,
): BuffetGuestHeadcount {
  let adults = 0;
  let children = 0;
  for (const sessionId of sessionIds) {
    const headcount = sessionGuestCounts(itemOrdersBySession.get(sessionId) || []);
    adults += headcount.adults;
    children += headcount.children;
  }
  return { adults, children };
}

/** Qualifying closed sessions → daily revenue series for the given Lisbon date keys. */
export function revenueTrendFromQualifying(
  dateKeys: string[],
  bundle: ClosedSessionRevenueBundle,
  qualifying: ClosedSessionRow[],
) {
  return buildRevenueTrend(
    dateKeys,
    qualifying,
    bundle.ordersBySession,
    bundle.splitsBySession,
    bundle.forcedClosedSessionIds,
  );
}

export function todayRevenueFromBundle(
  bundle: ClosedSessionRevenueBundle,
  todayDateKey: string,
  itemOrdersBySession: Map<string, AnalyticsItemOrder[]> = new Map(),
): {
  todayRevenue: number;
  revenueSessionCount: number;
  todayGuests: BuffetGuestHeadcount;
} {
  const qualifying = filterQualifyingClosedSessions(
    bundle.sessions,
    bundle.ordersBySession,
    bundle.splitsBySession,
  );
  const trend = revenueTrendFromQualifying([todayDateKey], bundle, qualifying);
  const sessionIds = todayRevenueSessionIds(bundle, todayDateKey, qualifying);
  return {
    todayRevenue: trend[0]?.revenue ?? 0,
    revenueSessionCount: sessionIds.length,
    todayGuests: todayGuestsForRevenueSessions(sessionIds, itemOrdersBySession),
  };
}
