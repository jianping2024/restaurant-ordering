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
  loadTransferEventsBySessionIds,
  type TransferOutEventRow,
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

type OrderHistoryFeedRpcItem = {
  kind: 'closed' | 'transfer';
  sort_at: string;
  session_id: string;
  event_id: string | null;
  payload: Record<string, unknown>;
};

type OrderHistoryFeedRpcPayload = {
  total?: number;
  items?: OrderHistoryFeedRpcItem[];
};

export class OrderHistoryLoadError extends Error {
  readonly code = 'order_history_load_failed' as const;

  constructor(message: string) {
    super(message);
    this.name = 'OrderHistoryLoadError';
  }
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

/** Sole orders loader for order-history pages — callers must pass page-sized session ids. */
async function loadOrdersForOrderHistoryPage(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
): Promise<Order[]> {
  const uniqueSessionIds = Array.from(new Set(sessionIds.filter(Boolean)));
  if (uniqueSessionIds.length === 0) return [];

  const { data, error } = await admin
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .in('session_id', uniqueSessionIds)
    .order('created_at', { ascending: true });

  if (error) {
    throw new OrderHistoryLoadError(`orders_query_failed: ${error.message}`);
  }

  return (data || []) as Order[];
}

function parseClosedSessionPayload(payload: Record<string, unknown>): ClosedSessionRow {
  return {
    id: String(payload.id),
    table_id: String(payload.table_id),
    opened_at: (payload.opened_at as string | null) ?? null,
    closed_at: String(payload.closed_at),
    closed_reason: (payload.closed_reason as string | null) ?? null,
    settled_payable_amount:
      payload.settled_payable_amount == null ? null : Number(payload.settled_payable_amount),
    opened_by_user_id: (payload.opened_by_user_id as string | null) ?? null,
    closed_by_user_id: (payload.closed_by_user_id as string | null) ?? null,
    merge_into_session_id: (payload.merge_into_session_id as string | null) ?? null,
  };
}

function parseTransferEventPayload(payload: Record<string, unknown>): TransferOutEventRow {
  return {
    id: String(payload.id),
    session_id: String(payload.session_id),
    occurred_at: String(payload.occurred_at),
    operator_user_id: (payload.operator_user_id as string | null) ?? null,
    from_table_id: String(payload.from_table_id),
    to_table_id: String(payload.to_table_id),
    from_display_name: String(payload.from_display_name ?? ''),
    to_display_name: String(payload.to_display_name ?? ''),
  };
}

/** Sole feed page fetch — DB union + sort + offset/limit. */
async function fetchOrderHistoryFeedPage(
  admin: SupabaseClient,
  query: OrderHistoryQuery,
  limit: number,
): Promise<{ total: number; items: OrderHistoryFeedRpcItem[] }> {
  const includeTransfers = !query.sessionId;
  const { data, error } = await admin.rpc('order_history_feed_page', {
    p_restaurant_id: query.restaurantId,
    p_closed_from: query.closedFrom ? orderHistoryDayStartIso(query.closedFrom) : null,
    p_closed_to: query.closedTo ? orderHistoryDayEndIso(query.closedTo) : null,
    p_table_ids: query.tableIds.length > 0 ? query.tableIds : null,
    p_session_id: query.sessionId ?? null,
    p_include_transfers: includeTransfers,
    p_offset: query.offset,
    p_limit: limit,
  });

  if (error) {
    throw new OrderHistoryLoadError(`feed_page_rpc_failed: ${error.message}`);
  }

  const payload = (data || {}) as OrderHistoryFeedRpcPayload;
  const items = Array.isArray(payload.items) ? payload.items : [];
  return {
    total: Number(payload.total) || 0,
    items: items.filter(
      (item): item is OrderHistoryFeedRpcItem =>
        !!item &&
        (item.kind === 'closed' || item.kind === 'transfer') &&
        !!item.payload &&
        typeof item.payload === 'object',
    ),
  };
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
  const limit = Math.max(1, Math.min(query.limit, 50));
  if (query.offset < 0) {
    return EMPTY_PAGE;
  }

  const feed = await fetchOrderHistoryFeedPage(admin, query, limit);
  if (feed.total === 0) {
    return EMPTY_PAGE;
  }
  if (query.offset > 0 && query.offset >= feed.total) {
    return { ...EMPTY_PAGE, total: feed.total };
  }
  if (feed.items.length === 0) {
    return { ...EMPTY_PAGE, total: feed.total };
  }

  const pageClosedSessions: ClosedSessionRow[] = [];
  const pageTransferEvents: TransferOutEventRow[] = [];
  for (const item of feed.items) {
    if (item.kind === 'closed') {
      pageClosedSessions.push(parseClosedSessionPayload(item.payload));
    } else {
      pageTransferEvents.push(parseTransferEventPayload(item.payload));
    }
  }
  const pageClosedSessionIds = pageClosedSessions.map((session) => session.id);

  const continuedSessionIds = Array.from(
    new Set([
      ...pageClosedSessions
        .map((session) => session.merge_into_session_id)
        .filter((id): id is string => !!id),
      ...pageTransferEvents.map((event) => event.session_id),
    ]),
  );

  const [orderRows, transferMetaBySessionId] = await Promise.all([
    loadOrdersForOrderHistoryPage(admin, query.restaurantId, pageClosedSessionIds),
    pageTransferEvents.length > 0
      ? loadTransferSourceSessionMetaById(
          admin,
          query.restaurantId,
          pageTransferEvents.map((event) => event.session_id),
        )
      : Promise.resolve(new Map<string, TransferSourceSessionMetaRow>()),
  ]);

  const ordersBySession = groupOrdersBySession(orderRows);
  const mergeTargetSessionIds = pageClosedSessions
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
    loadBillSplitsForOrderHistory(admin, query.restaurantId, pageClosedSessionIds),
    loadSessionCollectedPaymentsForOrderHistory(admin, query.restaurantId, pageClosedSessionIds),
    loadForcedUnpaidCloseAnnotations(admin, query.restaurantId, pageClosedSessionIds),
    loadMenuItemCodeLookup(admin, query.restaurantId, orderRows),
    loadMergeTargetSessionsById(admin, query.restaurantId, mergeTargetSessionIds),
    loadMergeSourceSessionsByTargetId(admin, query.restaurantId, pageClosedSessionIds),
    loadTransferEventsBySessionIds(admin, query.restaurantId, pageClosedSessionIds),
    loadMergeTargetSessionsById(admin, query.restaurantId, continuedSessionIds),
  ]);

  const transferTableIds = pageTransferEvents.flatMap((event) => [
    event.from_table_id,
    event.to_table_id,
  ]);

  const tableDisplayById = await loadRestaurantTableDisplayNames(
    admin,
    query.restaurantId,
    [
      ...collectOrderHistoryTableIds(pageClosedSessions, mergeTargetById, mergeSourcesByTargetId),
      ...transferTableIds,
    ],
  );

  const operatorIds = collectOrderHistoryOperatorIds(
    pageClosedSessions,
    mergeSourcesByTargetId,
    transferEventsBySession,
  );
  for (const event of pageTransferEvents) {
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

  const closedById = new Map(pageClosedSessions.map((session) => [session.id, session]));
  const transferByEventId = new Map(pageTransferEvents.map((event) => [event.id, event]));

  const items: OrderHistoryEntry[] = feed.items.map((item) => {
    if (item.kind === 'transfer') {
      const event = transferByEventId.get(String(item.event_id ?? item.payload.id));
      if (!event) {
        throw new OrderHistoryLoadError('transfer_payload_missing');
      }
      return buildTransferredSourceEntry(
        event,
        transferMetaBySessionId.get(event.session_id),
        tableDisplayById,
        continuedSessionById,
        operatorNames,
      );
    }

    const session = closedById.get(String(item.session_id ?? item.payload.id));
    if (!session) {
      throw new OrderHistoryLoadError('closed_payload_missing');
    }
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

  return { items, total: feed.total, itemCodeByMenuId };
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
