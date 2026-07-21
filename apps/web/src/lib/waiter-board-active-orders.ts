import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from '@/types';
import {
  ACTIVE_ORDER_STATUSES,
  filterOrdersInActiveSessions,
} from '@/lib/waiter-board-query';
import type { WaiterTableSessionRow } from '@/lib/waiter-table-session-meta';

const BOARD_ORDER_SELECT =
  'id, restaurant_id, session_id, table_id, display_name, status, items, total_amount, created_at, updated_at';

export type ActiveSessionOrderScope = {
  activeSessionIds: string[];
  activeTableIds: string[];
};

/** Active open/billing sessions → order query scope (empty when floor is all idle). */
export function activeSessionOrderScope(
  sessionRows: readonly WaiterTableSessionRow[],
): ActiveSessionOrderScope | null {
  const activeSessionIds = sessionRows.map((row) => row.id).filter(Boolean);
  const activeTableIds = sessionRows.map((row) => row.table_id).filter(Boolean);
  if (activeSessionIds.length === 0 && activeTableIds.length === 0) {
    return null;
  }
  return { activeSessionIds, activeTableIds };
}

/** PostgREST `.or()` filter: session orders + orphan rows on active tables. */
export function activeSessionOrdersOrFilter(scope: ActiveSessionOrderScope): string {
  const parts: string[] = [];
  if (scope.activeSessionIds.length > 0) {
    parts.push(`session_id.in.(${scope.activeSessionIds.join(',')})`);
  }
  if (scope.activeTableIds.length > 0) {
    parts.push(`and(table_id.in.(${scope.activeTableIds.join(',')}),session_id.is.null)`);
  }
  return parts.join(',');
}

/**
 * Board live/full occupancy: orders for active sessions only (not whole-restaurant scan).
 * Includes orphan rows (session_id null) on tables with an open/billing session.
 */
export async function loadOrdersForActiveWaiterBoardSessions(
  admin: SupabaseClient,
  restaurantId: string,
  sessionRows: readonly WaiterTableSessionRow[],
): Promise<Order[]> {
  const scope = activeSessionOrderScope(sessionRows);
  if (!scope) return [];

  let query = admin
    .from('orders')
    .select(BOARD_ORDER_SELECT)
    .eq('restaurant_id', restaurantId)
    .in('status', [...ACTIVE_ORDER_STATUSES])
    .order('updated_at', { ascending: false });

  const orFilter = activeSessionOrdersOrFilter(scope);
  if (orFilter.includes(',')) {
    query = query.or(orFilter);
  } else if (scope.activeSessionIds.length > 0) {
    query = query.in('session_id', scope.activeSessionIds);
  } else {
    query = query.in('table_id', scope.activeTableIds).is('session_id', null);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return filterOrdersInActiveSessions((data || []) as Order[], [...sessionRows]);
}
