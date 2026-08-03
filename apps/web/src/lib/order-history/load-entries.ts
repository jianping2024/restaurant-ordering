import type { SupabaseClient } from '@supabase/supabase-js';
import { groupOrdersBySession } from '@/lib/analytics/analytics.repository';
import { loadBillSplitsForOrderHistory } from '@/lib/order-history-bill-splits';
import {
  buildMergedSourceSessionSettlement,
  buildOrderHistorySessionSettlement,
} from '@/lib/order-history/build-session-settlement';
import {
  isMergedSourceCloseKind,
  resolveOrderHistoryCloseKind,
} from '@/lib/order-history/close-kind';
import {
  loadForcedUnpaidCloseAnnotations,
  resolveCloseAnnotationForSession,
} from '@/lib/order-history/load-forced-unpaid-close-annotations';
import {
  assembleMergeSourceRefs,
  assembleMergeTargetContext,
  collectOrderHistoryTableIds,
  loadMergeSourceSessionsByTargetId,
  loadMergeTargetSessionsById,
  loadRestaurantTableDisplayNames,
  type MergeSourceSessionRow,
  type MergeTargetSessionRow,
} from '@/lib/order-history/load-merge-context';
import { buildSessionLifecycleSteps } from '@/lib/order-history/build-session-lifecycle';
import { collectOrderHistoryOperatorIds } from '@/lib/order-history/collect-order-history-operator-ids';
import {
  attachTransferEventOperatorNames,
  loadSessionIdsTransferredFromTables,
  loadTransferEventsBySessionIds,
} from '@/lib/order-history/load-session-transfer-events';
import { loadSessionCollectedPaymentsForOrderHistory } from '@/lib/order-history/load-session-collected-payments';
import { countOrderListItems } from '@/lib/order-list-display';
import { resolveStaffOperatorNames } from '@/lib/order-history/resolve-staff-operator';
import { resolveSessionTableDisplayName } from '@/lib/order-history/resolve-session-table-display';
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
  opened_at: string | null;
  closed_at: string;
  closed_reason: string | null;
  settled_payable_amount: number | null;
  opened_by_user_id: string | null;
  closed_by_user_id: string | null;
  merge_into_session_id: string | null;
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

function applyDateSessionFilters<T extends {
  gte(column: string, value: string): T;
  lte(column: string, value: string): T;
}>(
  query: T,
  filters: Pick<OrderHistoryQuery, 'closedFrom' | 'closedTo'>,
): T {
  let next = query;
  if (filters.closedFrom) {
    next = next.gte('closed_at', startOfDayIso(filters.closedFrom));
  }
  if (filters.closedTo) {
    next = next.lte('closed_at', endOfDayIso(filters.closedTo));
  }
  return next;
}

function applyTableSessionFilter<T extends {
  in(column: string, values: string[]): T;
  or(filter: string): T;
}>(
  query: T,
  tableIds: string[],
  transferSessionIds: string[],
): T {
  if (tableIds.length === 0) return query;
  if (transferSessionIds.length === 0) {
    return query.in('table_id', tableIds);
  }
  const tableClause = `table_id.in.(${tableIds.join(',')})`;
  const sessionClause = `id.in.(${transferSessionIds.join(',')})`;
  return query.or(`${tableClause},${sessionClause}`);
}

function applySessionFilters<T extends {
  eq(column: string, value: string): T;
  in(column: string, values: string[]): T;
  or(filter: string): T;
  gte(column: string, value: string): T;
  lte(column: string, value: string): T;
}>(
  query: T,
  filters: Pick<OrderHistoryQuery, 'tableIds' | 'closedFrom' | 'closedTo' | 'sessionId'>,
  transferSessionIds: string[],
): T {
  if (filters.sessionId) {
    return query.eq('id', filters.sessionId);
  }
  let next = applyTableSessionFilter(query, filters.tableIds, transferSessionIds);
  next = applyDateSessionFilters(next, filters);
  return next;
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
  closedByName: string | null,
  billSplit: OrderHistoryEntry['billSplit'],
  collectedPayments: OrderHistoryEntry['settlement']['collectedPayments'],
  closeAnnotation: OrderHistoryEntry['closeAnnotation'],
  tableDisplayById: Map<string, string>,
  mergeTargetById: Map<string, MergeTargetSessionRow>,
  mergeSourcesByTargetId: Map<string, MergeSourceSessionRow[]>,
  operatorNames: ReadonlyMap<string, string>,
  transferEvents: OrderHistoryEntry['transferEvents'],
): OrderHistoryEntry {
  const closeKind = resolveOrderHistoryCloseKind(session.closed_reason);

  const entryFacts = {
    sessionId: session.id,
    tableId: session.table_id,
    displayName: resolveSessionTableDisplayName(
      session.table_id,
      tableDisplayById,
      sessionOrders,
    ),
    closeKind,
    openedAt: session.opened_at,
    openedByName,
    closedAt: session.closed_at,
    closedByName,
    closedReason: session.closed_reason,
    itemCount: countOrderListItems(sessionOrders),
    settlement: isMergedSourceCloseKind(closeKind)
      ? buildMergedSourceSessionSettlement()
      : buildOrderHistorySessionSettlement({
          billSplit,
          collectedPayments,
          orders: sessionOrders,
          closedReason: session.closed_reason,
          settledPayableAmount: session.settled_payable_amount,
        }),
    closeAnnotation,
    mergeContext: isMergedSourceCloseKind(closeKind)
      ? assembleMergeTargetContext(
          session.merge_into_session_id,
          tableDisplayById,
          mergeTargetById,
        )
      : undefined,
    mergeSources: assembleMergeSourceRefs(
      session.id,
      mergeSourcesByTargetId,
      tableDisplayById,
      operatorNames,
    ),
    transferEvents,
    billSplit,
    orders: sessionOrders,
  };

  return {
    ...entryFacts,
    lifecycleSteps: buildSessionLifecycleSteps({ ...entryFacts, lifecycleSteps: [] }),
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

  const transferSessionIds = query.sessionId
    ? []
    : await loadSessionIdsTransferredFromTables(
        admin,
        query.restaurantId,
        query.tableIds,
      );

  let countQuery = admin
    .from('table_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', query.restaurantId)
    .eq('status', 'closed');

  countQuery = applySessionFilters(countQuery, query, transferSessionIds);

  const { count, error: countError } = await countQuery;
  if (countError) {
    return EMPTY_PAGE;
  }

  const matchingTotal = count ?? 0;
  const cappedTotal = Math.min(matchingTotal, maxTotal);

  let sessionQuery = admin
    .from('table_sessions')
    .select(
      'id, table_id, opened_at, closed_at, closed_reason, settled_payable_amount, opened_by_user_id, closed_by_user_id, merge_into_session_id',
    )
    .eq('restaurant_id', query.restaurantId)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .range(query.offset, query.offset + limit - 1);

  sessionQuery = applySessionFilters(sessionQuery, query, transferSessionIds);

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

  const mergeTargetSessionIds = sessions
    .map((session) => session.merge_into_session_id)
    .filter((id): id is string => !!id);

  const [
    billSplitBySessionId,
    collectedPaymentsBySession,
    forcedCloseBySession,
    itemCodeByMenuId,
    mergeTargetById,
    mergeSourcesByTargetId,
    transferEventsBySession,
  ] = await Promise.all([
    loadBillSplitsForOrderHistory(admin, query.restaurantId, sessionIds),
    loadSessionCollectedPaymentsForOrderHistory(admin, query.restaurantId, sessionIds),
    loadForcedUnpaidCloseAnnotations(admin, query.restaurantId, sessionIds),
    loadMenuItemCodeLookup(admin, query.restaurantId, allSessionOrders),
    loadMergeTargetSessionsById(admin, query.restaurantId, mergeTargetSessionIds),
    loadMergeSourceSessionsByTargetId(admin, query.restaurantId, sessionIds),
    loadTransferEventsBySessionIds(admin, query.restaurantId, sessionIds),
  ]);

  const tableDisplayById = await loadRestaurantTableDisplayNames(
    admin,
    query.restaurantId,
    collectOrderHistoryTableIds(sessions, mergeTargetById, mergeSourcesByTargetId),
  );

  const operatorIds = collectOrderHistoryOperatorIds(
    sessions,
    mergeSourcesByTargetId,
    transferEventsBySession,
  );
  const operatorNames = await resolveStaffOperatorNames(admin, {
    restaurantId: query.restaurantId,
    ownerId: query.ownerId,
    restaurantName: query.restaurantName,
    userIds: operatorIds,
  });
  attachTransferEventOperatorNames(transferEventsBySession, operatorNames);

  const items = sessions.map((session) => {
    const sessionOrders = ordersBySession.get(session.id) || [];
    const billSplit = billSplitBySessionId[session.id];
    const collectedPayments = collectedPaymentsBySession.get(session.id) ?? [];
    const openedByName = session.opened_by_user_id
      ? operatorNames.get(session.opened_by_user_id) ?? null
      : null;
    const closedByName = session.closed_by_user_id
      ? operatorNames.get(session.closed_by_user_id) ?? null
      : null;
    const closeAnnotation = resolveCloseAnnotationForSession(
      session.id,
      forcedCloseBySession,
    );
    return buildEntry(
      session,
      sessionOrders,
      openedByName,
      closedByName,
      billSplit,
      collectedPayments,
      closeAnnotation,
      tableDisplayById,
      mergeTargetById,
      mergeSourcesByTargetId,
      operatorNames,
      transferEventsBySession.get(session.id),
    );
  });

  const loadedThrough = query.offset + items.length;
  const hasMore = items.length === limit && loadedThrough < cappedTotal;

  return { items, cappedTotal, hasMore, itemCodeByMenuId };
}

export function defaultOrderHistoryQuery(
  restaurant: { id: string; owner_id: string; name: string },
  filters: Pick<OrderHistoryQuery, 'tableIds' | 'closedFrom' | 'closedTo' | 'sessionId'> = {
    tableIds: [],
  },
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
    sessionId: filters.sessionId,
  };
}
