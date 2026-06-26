import type { Order } from '@/types';
import { tableIdsEqual } from '@/lib/restaurant-tables';

export function sessionIdForActiveTable(
  tableId: string,
  activeSessionByTableId: Record<string, string> = {},
): string | null {
  const direct = activeSessionByTableId[tableId];
  if (direct) return direct;
  for (const [tid, sid] of Object.entries(activeSessionByTableId)) {
    if (tableIdsEqual(tid, tableId)) return sid;
  }
  return null;
}

/** Session-wide orders when table has open/billing session; else this table's orders only.
 *  Used by the waiter board (full order list). Table detail uses fetchWaiterTableDetail instead.
 */
export function ordersForWaiterTableView(
  tableId: string,
  orders: Order[],
  activeSessionByTableId: Record<string, string> = {},
): Order[] {
  const sessionId = sessionIdForActiveTable(tableId, activeSessionByTableId);
  if (sessionId) {
    return orders.filter((o) => o.session_id === sessionId);
  }
  return orders.filter((o) => !o.session_id && tableIdsEqual(o.table_id, tableId));
}
