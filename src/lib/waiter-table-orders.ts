import type { Order } from '@/types';
import { tableIdsEqual } from '@/lib/restaurant-tables';

export function sessionIdForActiveTable(
  tableId: string,
  activeSessionByTableId: Record<string, string> = {},
): string | null {
  const map = activeSessionByTableId ?? {};
  const direct = map[tableId];
  if (direct) return direct;
  for (const [tid, sid] of Object.entries(map)) {
    if (tableIdsEqual(tid, tableId)) return sid;
  }
  return null;
}

export function tableHasOpenSession(
  tableId: string,
  activeSessionByTableId: Record<string, string> = {},
): boolean {
  return sessionIdForActiveTable(tableId, activeSessionByTableId) != null;
}

/** Session-wide orders when table has open/billing session; else this table's orders only. */
export function ordersForWaiterTableView(
  tableId: string,
  orders: Order[],
  activeSessionByTableId: Record<string, string> = {},
): Order[] {
  const sessionId = sessionIdForActiveTable(tableId, activeSessionByTableId);
  if (sessionId) {
    return orders.filter((o) => o.session_id === sessionId);
  }
  return orders.filter((o) => tableIdsEqual(o.table_id, tableId));
}
