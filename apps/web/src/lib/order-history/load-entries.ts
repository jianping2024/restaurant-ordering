import type { SupabaseClient } from '@supabase/supabase-js';
import { groupOrdersBySession } from '@/lib/analytics/analytics.repository';
import { loadBillSplitsForOrderHistory } from '@/lib/order-history-bill-splits';
import { defaultOrderHistoryCloseAnnotation } from '@/lib/order-history/build-bill-detail-view';
import { buildOrderHistorySessionSettlement } from '@/lib/order-history/build-session-settlement';
import { loadForcedUnpaidCloseAnnotations } from '@/lib/order-history/load-forced-unpaid-close-annotations';
import { loadSessionCollectedPaymentsForOrderHistory } from '@/lib/order-history/load-session-collected-payments';
import { countOrderListItems } from '@/lib/order-list-display';
import { resolveOpenedByNames } from '@/lib/order-history/resolve-opened-by';
import {
  distinctMenuItemIdsFromOrders,
  menuItemCodeLookupFromRows,
} from '@/lib/menu-item-code';
import {
  ORDER_HISTORY_MAX_TOTAL,
  ORDER_HISTORY_PAGE_SIZE,
  type OrderHistoryEntry,
  type OrderHistoryPageResult,
  type OrderHistoryQuery,
} from '@/lib/order-history/types';
import type { Order } from '@/types';

type ClosedSessionRow = {
  id: string;
  table_id: string;
  closed_at: string;
  opened_by_user_id: string | null;
};

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

function displayNameForSession(orders: Order[], tableId: string): string {
  const fromOrder = orders.find((order) => order.display_name?.trim())?.display_name?.trim();
  return fromOrder || tableId;
}

async function loadMenuItemCodeLookup(
  admin: SupabaseClient,
  restaurantId: string,
  orders: Order[],
): Promise<Record<string, string>> {
  const itemIds = distinctMenuItemIdsFromOrders(orders);
  if (itemIds.length === 0) return {};

  const { data, error } = await admin
    .from('menu_items')
    .select('id, item_code')
    .eq('restaurant_id', restaurantId)
    .in('id', itemIds);

  if (error || !data?.length) return {};
  return menuItemCodeLookupFromRows(data);
}

function buildEntry(
  session: ClosedSessionRow,
  sessionOrders: Order[],
  openedByName: string | null,
  billSplit: OrderHistoryEntry['billSplit'],
  collectedPayments: OrderHistoryEntry['settlement']['collectedPayments'],
  closeAnnotation: OrderHistoryEntry['closeAnnotation'],
): OrderHistoryEntry {
  return {
    sessionId: session.id,
    tableId: session.table_id,
    displayName: displayNameForSession(sessionOrders, session.table_id),
    closedAt: session.closed_at,
    openedByName,
    itemCount: countOrderListItems(sessionOrders),
    settlement: buildOrderHistorySessionSettlement({
      billSplit,
      collectedPayments,
      orders: sessionOrders,
    }),
    closeAnnotation,
    billSplit,
    orders: sessionOrders,
  };
}

const EMPTY_PAGE: OrderHistoryPageResult = {
  items: [],
  cappedTotal: 0,
  hasMore: false,
  itemCodeByMenuId: {},
};

export async function loadOrderHistoryEntries(
  admin: SupabaseClient,
  query: OrderHistoryQuery,
): Promise<OrderHistoryPageResult> {
  const maxTotal = query.maxTotal ?? ORDER_HISTORY_MAX_TOTAL;
  const limit = Math.min(query.limit, maxTotal - query.offset);
  if (limit <= 0 || query.offset >= maxTotal) {
    return { ...EMPTY_PAGE, cappedTotal: 0 };
  }

  let countQuery = admin
    .from('table_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', query.restaurantId)
    .eq('status', 'closed');

  countQuery = applySessionFilters(countQuery, query);

  const { count, error: countError } = await countQuery;
  if (countError) {
    return EMPTY_PAGE;
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
    return { ...EMPTY_PAGE, cappedTotal };
  }

  const sessions = sessionRows as ClosedSessionRow[];
  const sessionIds = sessions.map((session) => session.id);

  const { data: orderRows, error: ordersError } = await admin
    .from('orders')
    .select('*')
    .eq('restaurant_id', query.restaurantId)
    .in('session_id', sessionIds)
    .order('created_at', { ascending: true });

  if (ordersError) {
    return { ...EMPTY_PAGE, cappedTotal };
  }

  const ordersBySession = groupOrdersBySession((orderRows || []) as Order[]);
  const allSessionOrders = (orderRows || []) as Order[];

  const [billSplitBySessionId, collectedPaymentsBySession, forcedCloseBySession, itemCodeByMenuId] =
    await Promise.all([
      loadBillSplitsForOrderHistory(admin, query.restaurantId, sessionIds),
      loadSessionCollectedPaymentsForOrderHistory(admin, query.restaurantId, sessionIds),
      loadForcedUnpaidCloseAnnotations(admin, query.restaurantId, sessionIds),
      loadMenuItemCodeLookup(admin, query.restaurantId, allSessionOrders),
    ]);

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
    const closeAnnotation = defaultOrderHistoryCloseAnnotation(
      session.id,
      forcedCloseBySession,
    );
    return buildEntry(
      session,
      sessionOrders,
      openedByName,
      billSplit,
      collectedPayments,
      closeAnnotation,
    );
  });

  const loadedThrough = query.offset + items.length;
  const hasMore = items.length === limit && loadedThrough < cappedTotal;

  return { items, cappedTotal, hasMore, itemCodeByMenuId };
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
