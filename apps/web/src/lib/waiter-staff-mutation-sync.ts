import { buildWaiterBoardTableSummaries } from '@/lib/waiter-board-snapshot';
import type { WaiterBoardData } from '@/lib/staff-board';
import { tableIdsEqual } from '@/lib/restaurant-tables';
import { normalizeWaiterTablePageModel } from '@/lib/waiter-table-detail-normalize';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';

/** Ephemeral cross-route cache — bridges staff mutations until Staff API confirms. */
const publishedTableModels = new Map<string, WaiterTablePageModel>();

export type WaiterBoardReconcileResult = {
  board: WaiterBoardData;
  confirmedTableIds: string[];
};

export type WaiterSessionRelocationInput = {
  sourceTableId: string;
  targetModel: WaiterTablePageModel;
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

/**
 * After transfer/merge: drop source bridge, publish authoritative target model.
 * Returns affected table ids for board refresh.
 */
export function commitWaiterSessionRelocation(input: WaiterSessionRelocationInput): string[] {
  clearPublishedWaiterTablePageModel(input.sourceTableId);
  commitAuthoritativeWaiterTablePageModel(input.targetModel);
  const targetTableId = input.targetModel.detail.table?.id;
  if (!targetTableId) return [input.sourceTableId];
  if (tableIdsEqual(targetTableId, input.sourceTableId)) return [input.sourceTableId];
  return [input.sourceTableId, targetTableId];
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

/** Checkout / close-table: API is authoritative — drop open-table bridge before board refresh. */
export function releaseWaiterBoardTableBridge(tableIds: readonly string[]): void {
  clearConfirmedPublishedWaiterTablePageModels(tableIds);
}

function tableIdOwningSession(
  sessionId: string,
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
): string | null {
  for (const [tableId, meta] of Object.entries(sessionMetaByTableId)) {
    if (meta.sessionId === sessionId) return tableId;
  }
  return null;
}

/** Published session may overlay only the table that still owns it on the API board. */
function shouldApplyPublishedSessionOverlay(
  tableId: string,
  model: WaiterTablePageModel,
  apiSessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
): boolean {
  const pubSession = model.detail.sessionMeta;
  if (!pubSession) return true;

  const ownerTableId = tableIdOwningSession(pubSession.sessionId, apiSessionMetaByTableId);
  if (ownerTableId === null) return true;
  return tableIdsEqual(ownerTableId, tableId);
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

    if (
      model.detail.sessionMeta
      && !shouldApplyPublishedSessionOverlay(tableId, model, board.sessionMetaByTableId)
    ) {
      publishedTableModels.delete(tableId);
      continue;
    }

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
