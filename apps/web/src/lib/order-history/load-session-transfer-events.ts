import type { SupabaseClient } from '@supabase/supabase-js';
import {
  orderHistoryDayEndIso,
  orderHistoryDayStartIso,
} from '@/lib/order-history/date-range';
import type { OrderHistoryTransferEvent } from '@/lib/order-history/types';

export type TransferOutEventRow = {
  id: string;
  session_id: string;
  occurred_at: string;
  operator_user_id: string | null;
  from_table_id: string;
  to_table_id: string;
  from_display_name: string;
  to_display_name: string;
};

type TransferEventRow = TransferOutEventRow;

type TransferOutEventFilters = {
  tableIds: string[];
  closedFrom?: string;
  closedTo?: string;
};

function applyTransferOutEventFilters<T extends {
  in(column: string, values: string[]): T;
  gte(column: string, value: string): T;
  lte(column: string, value: string): T;
}>(
  query: T,
  filters: TransferOutEventFilters,
): T {
  let next = query;
  if (filters.tableIds.length > 0) {
    next = next.in('from_table_id', filters.tableIds);
  }
  if (filters.closedFrom) {
    next = next.gte('occurred_at', orderHistoryDayStartIso(filters.closedFrom));
  }
  if (filters.closedTo) {
    next = next.lte('occurred_at', orderHistoryDayEndIso(filters.closedTo));
  }
  return next;
}

/** Transfer-out events for source-table history rows. Fail-soft on error. */
export async function loadTransferOutEventsForHistory(
  admin: SupabaseClient,
  restaurantId: string,
  filters: TransferOutEventFilters,
): Promise<TransferOutEventRow[]> {
  let dataQuery = admin
    .from('table_session_events')
    .select(
      'id, session_id, occurred_at, operator_user_id, from_table_id, to_table_id, from_display_name, to_display_name',
    )
    .eq('restaurant_id', restaurantId)
    .eq('event_type', 'transfer')
    .order('occurred_at', { ascending: false });

  dataQuery = applyTransferOutEventFilters(dataQuery, filters);

  const { data, error } = await dataQuery;

  if (error) {
    console.error('[order-history] transfer-out events load failed', error.message);
    return [];
  }

  return (data || []) as TransferOutEventRow[];
}

export async function countTransferOutEventsForHistory(
  admin: SupabaseClient,
  restaurantId: string,
  filters: TransferOutEventFilters,
): Promise<number> {
  let query = admin
    .from('table_session_events')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('event_type', 'transfer');

  query = applyTransferOutEventFilters(query, filters);

  const { count, error } = await query;
  if (error) {
    console.error('[order-history] transfer-out count failed', error.message);
    return 0;
  }
  return count ?? 0;
}

/** Transfer events for billing session lifecycle (mid-meal moves). Fail-soft on error. */
export async function loadTransferEventsBySessionIds(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
): Promise<Map<string, OrderHistoryTransferEvent[]>> {
  const map = new Map<string, OrderHistoryTransferEvent[]>();
  const uniqueSessionIds = Array.from(new Set(sessionIds.filter(Boolean)));
  if (uniqueSessionIds.length === 0) return map;

  const { data, error } = await admin
    .from('table_session_events')
    .select(
      'id, session_id, occurred_at, operator_user_id, from_table_id, to_table_id, from_display_name, to_display_name',
    )
    .eq('restaurant_id', restaurantId)
    .eq('event_type', 'transfer')
    .in('session_id', uniqueSessionIds)
    .order('occurred_at', { ascending: true });

  if (error) {
    console.error('[order-history] transfer events load failed', error.message);
    return map;
  }

  for (const row of (data || []) as TransferEventRow[]) {
    const event: OrderHistoryTransferEvent = {
      id: row.id,
      occurredAt: row.occurred_at,
      operatorUserId: row.operator_user_id,
      operatorName: null,
      fromTableId: row.from_table_id,
      toTableId: row.to_table_id,
      fromDisplayName: row.from_display_name?.trim() || '—',
      toDisplayName: row.to_display_name?.trim() || '—',
    };
    const list = map.get(row.session_id) ?? [];
    list.push(event);
    map.set(row.session_id, list);
  }

  return map;
}

export function attachTransferEventOperatorNames(
  eventsBySession: Map<string, OrderHistoryTransferEvent[]>,
  operatorNames: ReadonlyMap<string, string>,
): void {
  for (const events of Array.from(eventsBySession.values())) {
    for (const event of events) {
      if (!event.operatorUserId) continue;
      event.operatorName = operatorNames.get(event.operatorUserId) ?? null;
    }
  }
}
