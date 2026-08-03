import type { WaiterBoardData } from '@/lib/staff-board';
import {
  buildIdleOpenTablePageModel,
  type WaiterBoardOpenTableDefaults,
} from '@/lib/waiter-board-open-table';
import {
  checkoutRequestedAtForTable,
  isTableCheckoutRequested,
} from '@/lib/table-checkout-pending';
import { partyIdForTable } from '@/lib/table-party-groups';
import { tableIdsEqual } from '@/lib/restaurant-tables';
import { snapshotToPageModel } from '@/lib/waiter-table-detail-snapshot';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';

/** Table detail transport: full includes open-table buffets/prices; live is occupancy only. */
export type WaiterTableDetailFetchScope = 'full' | 'live';

export function parseWaiterTableDetailFetchScope(
  value: string | null,
): WaiterTableDetailFetchScope {
  return value === 'live' ? 'live' : 'full';
}

/**
 * When live detail omitted open-table buffets, attach board defaults (one price source).
 */
export function attachOpenTableDefaultsToPageModel(
  model: WaiterTablePageModel,
  defaults: WaiterBoardOpenTableDefaults | null | undefined,
): WaiterTablePageModel {
  if (!defaults) return model;
  if (model.buffets.length > 0) return model;
  return {
    ...model,
    buffets: defaults.buffets,
    buffetPricesByBuffetId: defaults.buffetPricesByBuffetId,
  };
}

type BoardBootSource = Pick<
  WaiterBoardData,
  | 'tables'
  | 'sessionMetaByTableId'
  | 'openTableDefaults'
  | 'partyMembers'
  | 'checkoutRequestedTableIds'
  | 'checkoutRequestedAtByTableId'
>;

function findBoardTable(
  tables: BoardBootSource['tables'],
  tableId: string,
) {
  return (
    tables.find((row) => row.id === tableId) ??
    tables.find((row) => tableIdsEqual(row.id, tableId)) ??
    null
  );
}

function sessionMetaForBoardTable(
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
  tableId: string,
): WaiterTableSessionMeta | null {
  if (sessionMetaByTableId[tableId]) return sessionMetaByTableId[tableId];
  const match = Object.entries(sessionMetaByTableId).find(
    ([id]) => id === tableId || tableIdsEqual(id, tableId),
  );
  return match?.[1] ?? null;
}

/**
 * Idle boot is complete enough to skip mount entry reconcile.
 * Occupied chrome stubs still need an authoritative orders GET.
 */
export function isAuthoritativeIdleWaiterTableBoot(
  model: WaiterTablePageModel | null | undefined,
): boolean {
  return model != null && model.detail.table != null && model.detail.sessionMeta == null;
}

/**
 * Board → detail boot — one WaiterTablePageModel shape:
 * - idle: full open-table defaults (skip entry reconcile)
 * - occupied: chrome stub (session + checkout + buffet defaults, orders []); always reconcile
 */
export function buildWaiterTableDetailBootFromBoard(
  board: BoardBootSource,
  tableId: string,
): WaiterTablePageModel | null {
  const table = findBoardTable(board.tables, tableId);
  if (!table) return null;

  const inTableParty = partyIdForTable(board.partyMembers, tableId) != null;
  const sessionMeta = sessionMetaForBoardTable(board.sessionMetaByTableId, tableId);

  if (!sessionMeta) {
    if (!board.openTableDefaults) return null;
    return {
      ...buildIdleOpenTablePageModel(board.openTableDefaults, table),
      inTableParty,
    };
  }

  const buffets = board.openTableDefaults?.buffets ?? [];
  const buffetPricesByBuffetId = board.openTableDefaults?.buffetPricesByBuffetId ?? {};

  return snapshotToPageModel(
    {
      kind: 'active',
      table,
      buffets,
      buffetPricesByBuffetId,
      sessionMeta,
      orders: [],
      checkoutRequested: isTableCheckoutRequested(tableId, board.checkoutRequestedTableIds),
      checkoutRequestedAt: checkoutRequestedAtForTable(
        tableId,
        board.checkoutRequestedAtByTableId,
      ),
    },
    inTableParty,
  );
}
