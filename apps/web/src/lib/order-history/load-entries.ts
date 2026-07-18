import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildOrderHistorySessionView,
  toOrderHistoryListItem,
  type OrderHistoryClosedSession,
} from '@/lib/order-history/build-session-view';
import { loadOrderHistorySessionPayloads } from '@/lib/order-history/load-session-payloads';
import { resolveOpenedByNames } from '@/lib/order-history/resolve-opened-by';
import {
  ORDER_HISTORY_MAX_TOTAL,
  ORDER_HISTORY_PAGE_SIZE,
  type OrderHistoryPageResult,
  type OrderHistoryQuery,
} from '@/lib/order-history/types';

function startOfDayIso(dateKey: string): string {
  const date = new Date(dateKey);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function endOfDayIso(dateKey: string): string {
  const date = new Date(dateKey);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

function applySessionFilters<T extends {
  in(column: string, values: string[]): T;
  gte(column: string, value: string): T;
  lte(column: string, value: string): T;
}>(
  query: T,
  filters: Pick<OrderHistoryQuery, 'tableIds' | 'closedFrom' | 'closedTo'>,
): T {
  let next = query;
  if (filters.tableIds.length > 0) {
    next = next.in('table_id', filters.tableIds);
  }
  if (filters.closedFrom) {
    next = next.gte('closed_at', startOfDayIso(filters.closedFrom));
  }
  if (filters.closedTo) {
    next = next.lte('closed_at', endOfDayIso(filters.closedTo));
  }
  return next;
}

export async function loadOrderHistoryEntries(
  admin: SupabaseClient,
  query: OrderHistoryQuery,
): Promise<OrderHistoryPageResult> {
  const maxTotal = query.maxTotal ?? ORDER_HISTORY_MAX_TOTAL;
  const limit = Math.min(query.limit, maxTotal - query.offset);
  if (limit <= 0 || query.offset >= maxTotal) {
    return { items: [], cappedTotal: 0, hasMore: false };
  }

  let countQuery = admin
    .from('table_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', query.restaurantId)
    .eq('status', 'closed');

  countQuery = applySessionFilters(countQuery, query);

  const { count, error: countError } = await countQuery;
  if (countError) {
    return { items: [], cappedTotal: 0, hasMore: false };
  }

  const matchingTotal = count ?? 0;
  const cappedTotal = Math.min(matchingTotal, maxTotal);

  let sessionQuery = admin
    .from('table_sessions')
    .select('id, table_id, closed_at, opened_by_user_id')
    .eq('restaurant_id', query.restaurantId)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .range(query.offset, query.offset + limit - 1);

  sessionQuery = applySessionFilters(sessionQuery, query);

  const { data: sessionRows, error: sessionError } = await sessionQuery;
  if (sessionError || !sessionRows?.length) {
    return { items: [], cappedTotal, hasMore: false };
  }

  const sessions = sessionRows as OrderHistoryClosedSession[];
  const sessionIds = sessions.map((session) => session.id);

  const payloads = await loadOrderHistorySessionPayloads(
    admin,
    query.restaurantId,
    sessionIds,
  );
  if (!payloads) {
    return { items: [], cappedTotal, hasMore: false };
  }

  const { ordersBySession, billSplitBySessionId, collectedPaymentsBySession } = payloads;

  const openerIds = sessions
    .map((session) => session.opened_by_user_id)
    .filter((id): id is string => !!id);
  const openerNames = await resolveOpenedByNames(admin, {
    restaurantId: query.restaurantId,
    ownerId: query.ownerId,
    restaurantName: query.restaurantName,
    userIds: openerIds,
  });

  const items = sessions.map((session) => {
    const sessionOrders = ordersBySession.get(session.id) || [];
    const billSplit = billSplitBySessionId[session.id];
    const collectedPayments = collectedPaymentsBySession.get(session.id) ?? [];
    const openedByName = session.opened_by_user_id
      ? openerNames.get(session.opened_by_user_id) ?? null
      : null;
    return toOrderHistoryListItem(
      buildOrderHistorySessionView({
        session,
        orders: sessionOrders,
        openedByName,
        billSplit,
        collectedPayments,
      }),
    );
  });

  const loadedThrough = query.offset + items.length;
  const hasMore = items.length === limit && loadedThrough < cappedTotal;

  return { items, cappedTotal, hasMore };
}

export function defaultOrderHistoryQuery(
  restaurant: { id: string; owner_id: string; name: string },
  filters: Pick<OrderHistoryQuery, 'tableIds' | 'closedFrom' | 'closedTo'> = { tableIds: [] },
): OrderHistoryQuery {
  return {
    restaurantId: restaurant.id,
    ownerId: restaurant.owner_id,
    restaurantName: restaurant.name,
    offset: 0,
    limit: ORDER_HISTORY_PAGE_SIZE,
    maxTotal: ORDER_HISTORY_MAX_TOTAL,
    tableIds: filters.tableIds,
    closedFrom: filters.closedFrom,
    closedTo: filters.closedTo,
  };
}
