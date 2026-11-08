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
import type { WaiterBoardTableSummary } from '@/lib/waiter-board-snapshot';
import type { Order } from '@/types';

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
  | 'tableSummaries'
>;

function boardSummaryForTable(
  summaries: readonly WaiterBoardTableSummary[],
  tableId: string,
): WaiterBoardTableSummary | null {
  return (
    summaries.find((row) => row.tableId === tableId)
    ?? summaries.find((row) => tableIdsEqual(row.tableId, tableId))
    ?? null
  );
}

/**
 * Occupied board→detail first paint: seed the locked package + headcount the floor
 * already shows (`currentBuffetId` / `buffetHeadcount`). Keeps `currentTableBuffet`
 * as the sole reader — no empty-orders unlocked multi-pick flash.
 */
export function occupiedBootOrdersFromBoardSummary(
  tableId: string,
  sessionMeta: WaiterTableSessionMeta,
  summary: WaiterBoardTableSummary | null,
  buffetNameById: ReadonlyMap<string, string>,
): Order[] {
  const buffetId = summary?.currentBuffetId;
  if (!buffetId) return [];
  const adults = summary.buffetHeadcount?.adults ?? 0;
  const children = summary.buffetHeadcount?.children ?? 0;
  const stamp = sessionMeta.openedAt;
  const name = buffetNameById.get(buffetId) ?? '';
  return [
    {
      id: `board-boot:${tableId}`,
      restaurant_id: '',
      session_id: sessionMeta.sessionId,
      table_id: tableId,
      display_name: summary.displayName,
      status: 'done',
      items: [
        {
          id: `buffet:${buffetId}`,
          kind: 'buffet_base',
          name,
          name_pt: name,
          qty: 1,
          price: 0,
          emoji: '🍽️',
          item_status: 'done',
          buffet_id: buffetId,
          adult_count: adults,
          child_count: children,
          added_at: stamp,
          batch_id: '__buffet__',
        },
      ],
      total_amount: 0,
      created_at: stamp,
      updated_at: stamp,
    },
  ];
}

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

/** Sole paint phase for table detail shell (header / body slot / footer slot). */
export type WaiterTableDetailPaintPhase = 'cold' | 'chrome' | 'ready';

/**
 * Sole UI readiness representation — cold skeleton, chrome (toolbar ok, body waiting),
 * or ready (footer + authoritative body). Replaces parallel showColdContent / detailBodyReady.
 */
export function resolveWaiterTableDetailPaintPhase(input: {
  isDemo: boolean;
  /** Table chrome can paint (boot/GET set detailLoaded). */
  detailLoaded: boolean;
  /** Mount will run Staff entry reconcile (occupied stub / cold pull). */
  needsEntryPull: boolean;
  entryPullCompleted: boolean;
}): WaiterTableDetailPaintPhase {
  if (input.isDemo) return 'ready';
  if (!input.detailLoaded) return 'cold';
  if (input.needsEntryPull && !input.entryPullCompleted) return 'chrome';
  return 'ready';
}

/**
 * Board → detail boot — one WaiterTablePageModel shape:
 * - idle: full open-table defaults (skip entry reconcile)
 * - occupied: session + checkout + buffet defaults + board-known package/headcount
 *   orders (locked first paint); always reconcile for authoritative dish lines
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
  const buffetNameById = new Map(buffets.map((buffet) => [buffet.id, buffet.name]));
  const summary = boardSummaryForTable(board.tableSummaries, tableId);
  const orders = occupiedBootOrdersFromBoardSummary(
    tableId,
    sessionMeta,
    summary,
    buffetNameById,
  );

  return snapshotToPageModel(
    {
      kind: 'active',
      table,
      buffets,
      buffetPricesByBuffetId,
      sessionMeta,
      orders,
      checkoutRequested: isTableCheckoutRequested(tableId, board.checkoutRequestedTableIds),
      checkoutRequestedAt: checkoutRequestedAtForTable(
        tableId,
        board.checkoutRequestedAtByTableId,
      ),
    },
    inTableParty,
  );
}
