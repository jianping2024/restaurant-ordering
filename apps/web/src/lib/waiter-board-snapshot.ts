import { buildWaiterTableCard } from '@/components/waiter/waiter-table-card';
import type { BuffetGuestHeadcount } from '@/lib/buffet-order';
import { isWaiterTableCardOccupied } from '@/lib/waiter-table-occupancy';
import {
  sortWaiterTableCards,
  type WaiterTableCardSortInput,
} from '@/lib/restaurant-table-groups';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import { DEFAULT_TABLE_SEAT_MIN, DEFAULT_TABLE_SEAT_MAX } from '@/lib/restaurant-tables';
import {
  activeSessionIdByTableIdFromMeta,
  type WaiterTableSessionMeta,
} from '@/lib/waiter-board-session';
import { ordersForWaiterTableView } from '@/lib/waiter-table-orders';
import type { Order } from '@/types';

/** Server-built read model for one table on the waiter floor board. */
export type WaiterBoardTableSummary = {
  tableId: string;
  displayName: string;
  seatMin: number;
  seatMax: number;
  buffetHeadcount: BuffetGuestHeadcount | null;
  sessionTotal: number;
  hasBuffet: boolean;
  occupied: boolean;
  updatedAt: string;
};

/**
 * Derive board card summaries from active session orders (same rules as table detail,
 * scoped to what WaiterBoard displays).
 */
export function buildWaiterBoardTableSummaries(
  tables: readonly RestaurantTableRow[],
  orders: readonly Order[],
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
): WaiterBoardTableSummary[] {
  const activeSessionByTableId = activeSessionIdByTableIdFromMeta(sessionMetaByTableId);
  return tables.map((table) => {
    const view = ordersForWaiterTableView(table.id, orders as Order[], activeSessionByTableId);
    const card = buildWaiterTableCard(table.id, table.display_name, view);
    return {
      tableId: card.tableId,
      displayName: card.displayName,
      seatMin: table.seat_min ?? DEFAULT_TABLE_SEAT_MIN,
      seatMax: table.seat_max ?? DEFAULT_TABLE_SEAT_MAX,
      buffetHeadcount: card.buffetHeadcount,
      sessionTotal: card.sessionTotal,
      hasBuffet: card.hasBuffet,
      occupied: isWaiterTableCardOccupied(card),
      updatedAt: card.updatedAt,
    };
  });
}

/** Adapter for board sort — occupancy without shipping order lines to the client. */
export function waiterBoardSummaryToSortInput(
  summary: WaiterBoardTableSummary,
): WaiterTableCardSortInput {
  return {
    tableId: summary.tableId,
    displayName: summary.displayName,
    hasBuffet: summary.hasBuffet,
    orderLines: summary.occupied && !summary.hasBuffet ? [{}] : [],
  };
}

export function sortWaiterBoardTableSummaries(
  summaries: WaiterBoardTableSummary[],
  tables: readonly RestaurantTableRow[],
  checkoutRequestedTableIds: readonly string[],
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
): WaiterBoardTableSummary[] {
  const byTableId = new Map(summaries.map((summary) => [summary.tableId, summary]));
  const sorted = sortWaiterTableCards(
    summaries.map(waiterBoardSummaryToSortInput),
    tables,
    checkoutRequestedTableIds,
    sessionMetaByTableId,
  );
  return sorted.map((row) => byTableId.get(row.tableId)!);
}

export function waiterBoardSummariesByTableId(
  summaries: readonly WaiterBoardTableSummary[],
): Map<string, WaiterBoardTableSummary> {
  return new Map(summaries.map((summary) => [summary.tableId, summary]));
}
