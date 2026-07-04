import { buildWaiterBoardTableSummaries } from '@/lib/waiter-board-snapshot';
import type { WaiterBoardData } from '@/lib/staff-board';
import { tableIdsEqual } from '@/lib/restaurant-tables';
import { normalizeWaiterTablePageModel } from '@/lib/waiter-table-detail-normalize';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';

/** Ephemeral cross-route cache — bridges staff mutations until Staff API confirms. */
const publishedTableModels = new Map<string, WaiterTablePageModel>();

export type WaiterBoardReconcileResult = {
  board: WaiterBoardData;
  confirmedTableIds: string[];
};

/** Staff API–confirmed page model — written after mutations and detail entry reconcile. */
export function commitAuthoritativeWaiterTablePageModel(model: WaiterTablePageModel): void {
  const tableId = model.detail.table?.id;
  if (!tableId) return;
  const normalized = normalizeWaiterTablePageModel(model);
  if (normalized.detail.sessionMeta) {
    publishedTableModels.set(tableId, normalized);
  } else {
    publishedTableModels.delete(tableId);
  }
}

/** @deprecated Use commitAuthoritativeWaiterTablePageModel */
export function publishWaiterTablePageModel(model: WaiterTablePageModel): void {
  commitAuthoritativeWaiterTablePageModel(model);
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

export function clearConfirmedPublishedWaiterTablePageModels(tableIds: readonly string[]): void {
  for (const tableId of tableIds) {
    publishedTableModels.delete(tableId);
  }
}

function isPublishedModelConfirmedByApiBoard(
  tableId: string,
  apiBoard: WaiterBoardData,
  published: WaiterTablePageModel,
): boolean {
  const pubSession = published.detail.sessionMeta;
  const apiSession = apiBoard.sessionMetaByTableId[tableId];
  if (!pubSession) return !apiSession;
  return apiSession?.sessionId === pubSession.sessionId;
}

/** Merge published models, then list tableIds safe to clear (API session matches published). */
export function reconcileWaiterBoardWithPublished(apiBoard: WaiterBoardData): WaiterBoardReconcileResult {
  const merged = mergePublishedModelsIntoWaiterBoard(apiBoard);
  const confirmedTableIds: string[] = [];
  for (const [tableId, published] of Array.from(publishedTableModels.entries())) {
    if (isPublishedModelConfirmedByApiBoard(tableId, apiBoard, published)) {
      confirmedTableIds.push(tableId);
    }
  }
  return { board: merged, confirmedTableIds };
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
