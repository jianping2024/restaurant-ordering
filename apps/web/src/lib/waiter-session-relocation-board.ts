import {
  buildWaiterBoardTableSummaries,
  type WaiterBoardTableSummary,
} from '@/lib/waiter-board-snapshot';
import type { WaiterBoardData } from '@/lib/staff-board';
import {
  DEFAULT_TABLE_SEAT_MAX,
  DEFAULT_TABLE_SEAT_MIN,
  tableIdsEqual,
  type RestaurantTableRow,
} from '@/lib/restaurant-tables';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';

export type WaiterSessionRelocationBoardInput = {
  sourceTableId: string;
  targetModel: WaiterTablePageModel;
};

function buildIdleBoardSummary(table: RestaurantTableRow): WaiterBoardTableSummary {
  return {
    tableId: table.id,
    displayName: table.display_name,
    seatMin: table.seat_min ?? DEFAULT_TABLE_SEAT_MIN,
    seatMax: table.seat_max ?? DEFAULT_TABLE_SEAT_MAX,
    buffetHeadcount: null,
    sessionTotal: 0,
    hasBuffet: false,
    occupied: false,
    updatedAt: new Date(0).toISOString(),
  };
}

function boardSummaryFromPageModel(model: WaiterTablePageModel): WaiterBoardTableSummary | null {
  const table = model.detail.table;
  if (!table) return null;
  const sessionMeta = model.detail.sessionMeta;
  const metaByTableId = sessionMeta ? { [table.id]: sessionMeta } : {};
  const [summary] = buildWaiterBoardTableSummaries([table], model.detail.orders, metaByTableId);
  return summary ?? null;
}

function removeTableIdFromList(tableIds: readonly string[], tableId: string): string[] {
  return tableIds.filter((id) => !tableIdsEqual(id, tableId));
}

function removeTableIdFromRecord(
  map: Record<string, string>,
  tableId: string,
): Record<string, string> {
  const next = { ...map };
  for (const key of Object.keys(next)) {
    if (tableIdsEqual(key, tableId)) delete next[key];
  }
  return next;
}

function removeSessionMetaForTable(
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
  tableId: string,
): Record<string, WaiterTableSessionMeta> {
  const next = { ...sessionMetaByTableId };
  for (const key of Object.keys(next)) {
    if (tableIdsEqual(key, tableId)) delete next[key];
  }
  return next;
}

function upsertTableSummary(
  summaries: WaiterBoardTableSummary[],
  tableId: string,
  summary: WaiterBoardTableSummary,
): WaiterBoardTableSummary[] {
  const next = [...summaries];
  const idx = next.findIndex((row) => tableIdsEqual(row.tableId, tableId));
  if (idx >= 0) next[idx] = summary;
  else next.push(summary);
  return next;
}

function syncCheckoutFlagsForTable(
  board: Pick<WaiterBoardData, 'checkoutRequestedTableIds' | 'checkoutRequestedAtByTableId'>,
  tableId: string,
  requested: boolean,
  requestedAt: string | null,
): Pick<WaiterBoardData, 'checkoutRequestedTableIds' | 'checkoutRequestedAtByTableId'> {
  let checkoutRequestedTableIds = removeTableIdFromList(board.checkoutRequestedTableIds, tableId);
  let checkoutRequestedAtByTableId = removeTableIdFromRecord(
    board.checkoutRequestedAtByTableId,
    tableId,
  );
  if (requested) {
    checkoutRequestedTableIds = [...checkoutRequestedTableIds, tableId];
    if (requestedAt) {
      checkoutRequestedAtByTableId = { ...checkoutRequestedAtByTableId, [tableId]: requestedAt };
    }
  }
  return { checkoutRequestedTableIds, checkoutRequestedAtByTableId };
}

/** Patch waiter board read-model after transfer/merge — no extra network. */
export function applyWaiterSessionRelocationToBoard(
  board: WaiterBoardData,
  input: WaiterSessionRelocationBoardInput,
): WaiterBoardData {
  const { sourceTableId, targetModel } = input;
  const targetTable = targetModel.detail.table;
  if (!targetTable) return board;

  let sessionMetaByTableId = removeSessionMetaForTable(board.sessionMetaByTableId, sourceTableId);
  const targetMeta = targetModel.detail.sessionMeta;
  if (targetMeta) {
    sessionMetaByTableId = { ...sessionMetaByTableId, [targetTable.id]: targetMeta };
  }

  const sourceCheckout = syncCheckoutFlagsForTable(board, sourceTableId, false, null);
  const checkout = syncCheckoutFlagsForTable(
    sourceCheckout,
    targetTable.id,
    targetModel.detail.checkoutRequested,
    targetModel.detail.checkoutRequestedAt,
  );

  let tableSummaries = board.tableSummaries;
  const sourceTable = board.tables.find((row) => tableIdsEqual(row.id, sourceTableId));
  if (sourceTable) {
    tableSummaries = upsertTableSummary(
      tableSummaries,
      sourceTableId,
      buildIdleBoardSummary(sourceTable),
    );
  }

  const targetSummary = boardSummaryFromPageModel(targetModel);
  if (targetSummary) {
    tableSummaries = upsertTableSummary(tableSummaries, targetTable.id, targetSummary);
  }

  return {
    ...board,
    sessionMetaByTableId,
    checkoutRequestedTableIds: checkout.checkoutRequestedTableIds,
    checkoutRequestedAtByTableId: checkout.checkoutRequestedAtByTableId,
    tableSummaries,
  };
}
