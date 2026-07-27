import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderHistoryTransferEvent } from '@/lib/order-history/types';

type TransferEventRow = {
  id: string;
  session_id: string;
  occurred_at: string;
  operator_user_id: string | null;
  from_table_id: string;
  to_table_id: string;
  from_display_name: string;
  to_display_name: string;
};

/** Session ids that transferred out from any of the filtered tables (S2). Fail-soft on error. */
export async function loadSessionIdsTransferredFromTables(
  admin: SupabaseClient,
  restaurantId: string,
  fromTableIds: string[],
): Promise<string[]> {
  const uniqueTableIds = Array.from(new Set(fromTableIds.filter(Boolean)));
  if (uniqueTableIds.length === 0) return [];

  const { data, error } = await admin
    .from('table_session_events')
    .select('session_id')
    .eq('restaurant_id', restaurantId)
    .eq('event_type', 'transfer')
    .in('from_table_id', uniqueTableIds);

  if (error) {
    console.error('[order-history] transfer filter lookup failed', error.message);
    return [];
  }

  return Array.from(
    new Set((data || []).map((row) => (row as { session_id: string }).session_id).filter(Boolean)),
  );
}

/** Transfer events for closed sessions on the current page. Fail-soft on error. */
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
