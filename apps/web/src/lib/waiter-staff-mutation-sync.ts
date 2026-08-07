import { buildWaiterBoardTableSummaries } from '@/lib/waiter-board-snapshot';
import type { WaiterBoardData } from '@/lib/staff-board';
import { tableIdsEqual } from '@/lib/restaurant-tables';
import { normalizeWaiterTablePageModel } from '@/lib/waiter-table-detail-normalize';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';

/**
 * Ephemeral cross-route cache for **local-ahead** paint only (open-table / detail
 * bootstrap via `mergePublishedModelsIntoWaiterBoard`).
 *
 * After any Staff board API response, occupancy is the API board alone —
 * `reconcileWaiterBoardWithPublished` returns that board and drops every bridge.
 * Never re-apply published orders/session over a fetched board (remote close,
 * headcount, amounts).
 */
const publishedTableModels = new Map<string, WaiterTablePageModel>();

export type WaiterBoardReconcileResult = {
  board: WaiterBoardData;
  /** Bridges dropped because a Staff board API response is now authoritative. */
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

/**
 * After Staff board GET (live/full): board occupancy is only `apiBoard`.
 * Drop every published bridge — do not overlay stale session/orders/headcount.
 */
export function reconcileWaiterBoardWithPublished(apiBoard: WaiterBoardData): WaiterBoardReconcileResult {
  const confirmedTableIds = Array.from(publishedTableModels.keys());
  return { board: apiBoard, confirmedTableIds };
}

/**
 * Local-ahead only: paint published models onto the **client** board (open-table /
 * bootstrap). Skip when this board already shows the session on another table.
 * Never used to reinterpret a Staff board API response — that path is reconcile.
 */
export function mergePublishedModelsIntoWaiterBoard(board: WaiterBoardData): WaiterBoardData {
  if (publishedTableModels.size === 0) return board;

  let sessionMetaByTableId = { ...board.sessionMetaByTableId };
  const tableSummaries = [...board.tableSummaries];

  for (const [tableId, model] of Array.from(publishedTableModels.entries())) {
    const table = model.detail.table;
    if (!table) continue;

    const pubSession = model.detail.sessionMeta;
    if (pubSession) {
      const ownerTableId = tableIdOwningSession(pubSession.sessionId, board.sessionMetaByTableId);
      if (ownerTableId !== null && !tableIdsEqual(ownerTableId, tableId)) {
        publishedTableModels.delete(tableId);
        continue;
      }
      sessionMetaByTableId = {
        ...sessionMetaByTableId,
        [tableId]: pubSession,
      };
    }

    const [patchSummary] = buildWaiterBoardTableSummaries(
      [table],
      model.detail.orders,
      pubSession ? { [tableId]: pubSession } : sessionMetaByTableId,
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
