import { buildWaiterTableCard } from '@/components/waiter/waiter-table-card';
import { ordersForWaiterTableView } from '@/lib/waiter-table-orders';
import {
  activeSessionIdByTableIdFromMeta,
  type WaiterTableSessionMeta,
} from '@/lib/waiter-board-session';
import { sortRestaurantTables, tableIdsEqual, type RestaurantTableRow } from '@/lib/restaurant-tables';
import type { Order } from '@/types';

export type WaiterTableOccupancyInput = {
  orderLines: unknown[];
  hasBuffet: boolean;
};

/** Table has visible menu lines or an active buffet base on the current session. */
export function isWaiterTableCardOccupied(card: WaiterTableOccupancyInput): boolean {
  return card.orderLines.length > 0 || card.hasBuffet;
}

/** Tables with visible order lines or an active buffet base on the current session. */
export function activeWaiterTableIds(
  tables: readonly RestaurantTableRow[],
  orders: readonly Order[],
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
): string[] {
  const activeSessionByTableId = activeSessionIdByTableIdFromMeta(sessionMetaByTableId);
  const active: string[] = [];
  for (const table of tables) {
    const view = ordersForWaiterTableView(table.id, orders as Order[], activeSessionByTableId);
    const card = buildWaiterTableCard(table.id, table.display_name, view);
    if (isWaiterTableCardOccupied(card)) {
      active.push(table.id);
    }
  }
  return active;
}

export function filterWaiterTableActionTargets(
  tables: readonly RestaurantTableRow[],
  activeTableIds: readonly string[],
  sourceTableId: string,
  operation: 'transfer' | 'merge',
): RestaurantTableRow[] {
  const sorted = sortRestaurantTables([...tables]);
  if (operation === 'transfer') {
    return sorted.filter(
      (table) =>
        !activeTableIds.some((id) => tableIdsEqual(id, table.id)) &&
        !tableIdsEqual(table.id, sourceTableId),
    );
  }
  return sorted.filter(
    (table) =>
      activeTableIds.some((id) => tableIdsEqual(id, table.id)) &&
      !tableIdsEqual(table.id, sourceTableId),
  );
}
