import type { WaiterBoardData } from '@/lib/staff-board';
import {
  buildIdleOpenTablePageModel,
  type WaiterBoardOpenTableDefaults,
} from '@/lib/waiter-board-open-table';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import { partyIdForTable } from '@/lib/table-party-groups';

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

/**
 * Idle table boot from hydrated board — same model shape as staff API idle payload.
 * Active tables return null (orders require authoritative GET).
 */
export function buildWaiterTableDetailBootFromBoard(
  board: Pick<
    WaiterBoardData,
    'tables' | 'sessionMetaByTableId' | 'openTableDefaults' | 'partyMembers'
  >,
  tableId: string,
): WaiterTablePageModel | null {
  if (board.sessionMetaByTableId[tableId]) return null;
  const table = board.tables.find((row) => row.id === tableId);
  if (!table || !board.openTableDefaults) return null;
  const model = buildIdleOpenTablePageModel(board.openTableDefaults, table);
  return {
    ...model,
    inTableParty: partyIdForTable(board.partyMembers, tableId) != null,
  };
}
