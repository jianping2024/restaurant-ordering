import {
  DEFAULT_TABLE_SEAT_MAX,
  DEFAULT_TABLE_SEAT_MIN,
  type RestaurantTableRow,
} from '@/lib/restaurant-tables';
import type { WaiterBoardTableSummary } from '@/lib/waiter-board-snapshot';

function idleSummaryForFloorTable(table: RestaurantTableRow): WaiterBoardTableSummary {
  return {
    tableId: table.id,
    displayName: table.display_name,
    seatMin: table.seat_min ?? DEFAULT_TABLE_SEAT_MIN,
    seatMax: table.seat_max ?? DEFAULT_TABLE_SEAT_MAX,
    buffetHeadcount: null,
    sessionTotal: 0,
    hasBuffet: false,
    occupied: false,
    updatedAt: '',
  };
}

/**
 * Rebuild full-floor summaries from floor static tables + live occupancy rows
 * (live may only include active tables; displayName/seats always from floor).
 */
export function mergeLiveTableSummariesOntoFloor(
  floorTables: readonly RestaurantTableRow[],
  liveSummaries: readonly WaiterBoardTableSummary[],
): WaiterBoardTableSummary[] {
  const byId = new Map(liveSummaries.map((summary) => [summary.tableId, summary]));
  return floorTables.map((table) => {
    const live = byId.get(table.id);
    if (!live) return idleSummaryForFloorTable(table);
    return {
      ...live,
      displayName: table.display_name,
      seatMin: table.seat_min ?? DEFAULT_TABLE_SEAT_MIN,
      seatMax: table.seat_max ?? DEFAULT_TABLE_SEAT_MAX,
    };
  });
}
