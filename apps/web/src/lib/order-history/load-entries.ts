import type { SupabaseClient } from '@supabase/supabase-js';
import { groupOrdersBySession } from '@/lib/analytics/analytics.repository';
import { loadBillSplitsForOrderHistory } from '@/lib/order-history-bill-splits';
import {
  buildOperationalSourceSessionSettlement,
  buildOrderHistorySessionSettlement,
} from '@/lib/order-history/build-session-settlement';
import { buildTransferredSourceEntry } from '@/lib/order-history/build-transferred-source-entry';
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
  countTransferOutEventsForHistory,
  loadTransferEventsBySessionIds,
  loadTransferOutEventsForHistory,
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
  orderHistoryDayEndIso,
  orderHistoryDayStartIso,
} from '@/lib/order-history/date-range';
import { resolveListFiltersOrDefault } from '@/lib/order-history/parse-query';
import type {
  OrderHistoryEntry,
  OrderHistoryPageResult,
  OrderHistoryQuery,
} from '@/lib/order-history/types';
import { LIST_DEFAULT_PAGE_SIZE } from '@/lib/paginate-list';
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

type TransferSourceSessionMetaRow = {
  id: string;
  opened_at: string | null;
  opened_by_user_id: string | null;
};

function applyDateSessionFilters<T extends {
  gte(column: string, value: string): T;
  lte(column: string, value: string): T;
}>(
  query: T,
  filters: Pick<OrderHistoryQuery, 'closedFrom' | 'closedTo'>,
): T {
  let next = query;
  if (filters.closedFrom) {
    next = next.gte('closed_at', orderHistoryDayStartIso(filters.closedFrom));
  }
  if (filters.closedTo) {
    next = next.lte('closed_at', orderHistoryDayEndIso(filters.closedTo));
  }
  return next;
}

function applyClosedSessionTableFilter<T extends { in(column: string, values: string[]): T }>(
  query: T,
  tableIds: string[],
): T {
  if (tableIds.length === 0) return query;
  return query.in('table_id', tableIds);
}

function applySessionFilters<T extends {
  eq(column: string, value: string): T;
  in(column: string, values: string[]): T;
  gte(column: string, value: string): T;
  lte(column: string, value: string): T;
}>(
  query: T,
  filters: Pick<OrderHistoryQuery, 'tableIds' | 'closedFrom' | 'closedTo' | 'sessionId'>,
): T {
  if (filters.sessionId) {
    return query.eq('id', filters.sessionId);
  }
  let next = applyClosedSessionTableFilter(query, filters.tableIds);
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

function buildClosedSessionEntry(
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
    historyRecordId: session.id,
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
      ? buildOperationalSourceSessionSettlement()
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

async function loadTransferSourceSessionMetaById(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
): Promise<Map<string, TransferSourceSessionMetaRow>> {
  const uniqueSessionIds = Array.from(new Set(sessionIds.filter(Boolean)));
  const map = new Map<string, TransferSourceSessionMetaRow>();
  if (uniqueSessionIds.length === 0) return map;

  const { data, error } = await admin
    .from('table_sessions')
    .select('id, opened_at, opened_by_user_id')
    .eq('restaurant_id', restaurantId)
    .in('id', uniqueSessionIds);

  if (error || !data?.length) return map;

  for (const row of data as TransferSourceSessionMetaRow[]) {
    map.set(row.id, row);
  }
  return map;
}

function mergeHistoryFeed(
  closedEntries: OrderHistoryEntry[],
  transferSourceEntries: OrderHistoryEntry[],
  offset: number,
  limit: number,
  matchingTotal: number,
): Pick<OrderHistoryPageResult, 'items' | 'total'> {
  const merged = [...closedEntries, ...transferSourceEntries].sort((left, right) =>
    right.closedAt.localeCompare(left.closedAt),
  );

  const items = merged.slice(offset, offset + limit);
  return { items, total: matchingTotal };
}

const EMPTY_PAGE: OrderHistoryPageResult = {
  items: [],
  total: 0,
  itemCodeByMenuId: {},
};

export async function loadOrderHistoryEntries(
  admin: SupabaseClient,
  query: OrderHistoryQuery,
): Promise<OrderHistoryPageResult> {
  const limit = Math.max(1, query.limit);
  if (limit <= 0 || query.offset < 0) {
    return EMPTY_PAGE;
  }

  const eventFilters = {
    tableIds: query.tableIds,
    closedFrom: query.closedFrom,
    closedTo: query.closedTo,
  };

  const includeTransferSourceRows = !query.sessionId;

  let countQuery = admin
    .from('table_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', query.restaurantId)
    .eq('status', 'closed');

  countQuery = applySessionFilters(countQuery, query);

  const [closedCountResult, transferOutCount] = await Promise.all([
    countQuery,
    includeTransferSourceRows
      ? countTransferOutEventsForHistory(admin, query.restaurantId, eventFilters)
      : Promise.resolve(0),
  ]);

  const { count, error: countError } = closedCountResult;
  if (countError) {
    return EMPTY_PAGE;
  }

  const matchingTotal = (count ?? 0) + transferOutCount;
  if (query.offset > 0 && query.offset >= matchingTotal) {
    return { ...EMPTY_PAGE, total: matchingTotal };
  }

  let sessionQuery = admin
    .from('table_sessions')
    .select(
      'id, table_id, opened_at, closed_at, closed_reason, settled_payable_amount, opened_by_user_id, closed_by_user_id, merge_into_session_id',
    )
    .eq('restaurant_id', query.restaurantId)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false });

  sessionQuery = applySessionFilters(sessionQuery, query);

  const [sessionResult, transferOutEvents] = await Promise.all([
    sessionQuery,
    includeTransferSourceRows
      ? loadTransferOutEventsForHistory(admin, query.restaurantId, eventFilters)
      : Promise.resolve([]),
  ]);

  const { data: sessionRows, error: sessionError } = sessionResult;
  if (sessionError) {
    return EMPTY_PAGE;
  }

  const sessions = (sessionRows || []) as ClosedSessionRow[];
  const sessionIds = sessions.map((session) => session.id);

  const continuedSessionIds = Array.from(
    new Set([
      ...sessions
        .map((session) => session.merge_into_session_id)
        .filter((id): id is string => !!id),
      ...transferOutEvents.map((event) => event.session_id),
    ]),
  );

  const transferMetaBySessionId = includeTransferSourceRows
    ? await loadTransferSourceSessionMetaById(
        admin,
        query.restaurantId,
        transferOutEvents.map((event) => event.session_id),
      )
    : new Map<string, TransferSourceSessionMetaRow>();

  const { data: orderRows, error: ordersError } =
    sessionIds.length === 0
      ? { data: [] as Order[], error: null }
      : await admin
          .from('orders')
          .select('*')
          .eq('restaurant_id', query.restaurantId)
          .in('session_id', sessionIds)
          .order('created_at', { ascending: true });

  if (ordersError) {
    return EMPTY_PAGE;
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
    continuedSessionById,
  ] = await Promise.all([
    loadBillSplitsForOrderHistory(admin, query.restaurantId, sessionIds),
    loadSessionCollectedPaymentsForOrderHistory(admin, query.restaurantId, sessionIds),
    loadForcedUnpaidCloseAnnotations(admin, query.restaurantId, sessionIds),
    loadMenuItemCodeLookup(admin, query.restaurantId, allSessionOrders),
    loadMergeTargetSessionsById(admin, query.restaurantId, mergeTargetSessionIds),
    loadMergeSourceSessionsByTargetId(admin, query.restaurantId, sessionIds),
    loadTransferEventsBySessionIds(admin, query.restaurantId, sessionIds),
    loadMergeTargetSessionsById(admin, query.restaurantId, continuedSessionIds),
  ]);

  const transferTableIds = transferOutEvents.flatMap((event) => [
    event.from_table_id,
    event.to_table_id,
  ]);

  const tableDisplayById = await loadRestaurantTableDisplayNames(
    admin,
    query.restaurantId,
    [
      ...collectOrderHistoryTableIds(sessions, mergeTargetById, mergeSourcesByTargetId),
      ...transferTableIds,
    ],
  );

  const operatorIds = collectOrderHistoryOperatorIds(
    sessions,
    mergeSourcesByTargetId,
    transferEventsBySession,
  );
  for (const event of transferOutEvents) {
    if (event.operator_user_id) operatorIds.push(event.operator_user_id);
    const meta = transferMetaBySessionId.get(event.session_id);
    if (meta?.opened_by_user_id) operatorIds.push(meta.opened_by_user_id);
  }

  const operatorNames = await resolveStaffOperatorNames(admin, {
    restaurantId: query.restaurantId,
    ownerId: query.ownerId,
    restaurantName: query.restaurantName,
    userIds: operatorIds,
  });
  attachTransferEventOperatorNames(transferEventsBySession, operatorNames);

  const closedEntries = sessions.map((session) => {
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
    return buildClosedSessionEntry(
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

  const transferSourceEntries = includeTransferSourceRows
    ? transferOutEvents.map((event) =>
        buildTransferredSourceEntry(
          event,
          transferMetaBySessionId.get(event.session_id),
          tableDisplayById,
          continuedSessionById,
          operatorNames,
        ),
      )
    : [];

  const { items, total } = mergeHistoryFeed(
    closedEntries,
    transferSourceEntries,
    query.offset,
    limit,
    matchingTotal,
  );

  return { items, total, itemCodeByMenuId };
}

export function defaultOrderHistoryQuery(
  restaurant: { id: string; owner_id: string; name: string },
  filters: Pick<OrderHistoryQuery, 'tableIds' | 'closedFrom' | 'closedTo' | 'sessionId'> = {
    tableIds: [],
  },
): OrderHistoryQuery {
  const listFilters = filters.sessionId
    ? {
        tableIds: filters.tableIds,
        closedFrom: filters.closedFrom,
        closedTo: filters.closedTo,
        sessionId: filters.sessionId,
      }
    : resolveListFiltersOrDefault(filters);

  return {
    restaurantId: restaurant.id,
    ownerId: restaurant.owner_id,
    restaurantName: restaurant.name,
    offset: 0,
    limit: LIST_DEFAULT_PAGE_SIZE,
    ...listFilters,
  };
}
