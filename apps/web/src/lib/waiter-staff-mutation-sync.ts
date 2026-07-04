import { buildWaiterBoardTableSummaries } from '@/lib/waiter-board-snapshot';
import type { WaiterBoardData } from '@/lib/staff-board';
import { tableIdsEqual } from '@/lib/restaurant-tables';
import { normalizeWaiterTablePageModel } from '@/lib/waiter-table-detail-normalize';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';

/** Ephemeral cross-route cache — bridges staff mutations until Staff API entry reconcile. */
const publishedTableModels = new Map<string, WaiterTablePageModel>();

export function publishWaiterTablePageModel(model: WaiterTablePageModel): void {
  const tableId = model.detail.table?.id;
  if (!tableId) return;
  publishedTableModels.set(tableId, normalizeWaiterTablePageModel(model));
}

export function peekPublishedWaiterTablePageModel(tableId: string): WaiterTablePageModel | null {
  return publishedTableModels.get(tableId) ?? null;
}

export function clearPublishedWaiterTablePageModel(tableId: string): void {
  publishedTableModels.delete(tableId);
}

export function clearAllPublishedWaiterTablePageModels(): void {
  publishedTableModels.clear();
}

/** Merge published table models into board read-model (session meta + card summaries). */
export function mergePublishedModelsIntoWaiterBoard(board: WaiterBoardData): WaiterBoardData {
  if (publishedTableModels.size === 0) return board;

  let sessionMetaByTableId = { ...board.sessionMetaByTableId };
  const tableSummaries = [...board.tableSummaries];

  for (const [tableId, model] of Array.from(publishedTableModels.entries())) {
    const table = model.detail.table;
    if (!table) continue;

    if (model.detail.sessionMeta) {
      sessionMetaByTableId = {
        ...sessionMetaByTableId,
        [tableId]: model.detail.sessionMeta,
      };
    }

    const [patchSummary] = buildWaiterBoardTableSummaries(
      [table],
      model.detail.orders,
      model.detail.sessionMeta ? { [tableId]: model.detail.sessionMeta } : sessionMetaByTableId,
    );
    if (!patchSummary) continue;

    const idx = tableSummaries.findIndex((row) => tableIdsEqual(row.tableId, tableId));
    if (idx >= 0) {
      tableSummaries[idx] = patchSummary;
    } else {
      tableSummaries.push(patchSummary);
    }
  }

  return { ...board, sessionMetaByTableId, tableSummaries };
}

export function bootstrapWaiterBoardData(board: WaiterBoardData): WaiterBoardData {
  return mergePublishedModelsIntoWaiterBoard(board);
}
