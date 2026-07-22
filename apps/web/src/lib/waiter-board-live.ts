import type { WaiterBoardData } from '@/lib/staff-board';
import type { TablePartyGroup, TablePartyGroupMember } from '@/lib/table-party-groups';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import type { WaiterBoardTableSummary } from '@/lib/waiter-board-snapshot';
import {
  mergeLiveSessionMetaPreservingOpenerNames,
  mergeLiveTableSummariesOntoFloor,
} from '@/lib/waiter-board-live-merge';

/** Board refresh transport: full = static+live; live = doorbell slice only. */
export type WaiterBoardFetchScope = 'full' | 'live';

/**
 * Live slice only — sessions, orders-derived summaries, checkout, parties.
 * Floor static (tables/groups/members/openTableDefaults) stays on the client board.
 * tableSummaries may only include active tables; client merges onto floor tables.
 */
export type WaiterBoardLivePatch = {
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>;
  checkoutRequestedTableIds: string[];
  checkoutRequestedAtByTableId: Record<string, string>;
  parties: TablePartyGroup[];
  partyMembers: TablePartyGroupMember[];
  tableSummaries: WaiterBoardTableSummary[];
};

/** One merge rule: live keys overwrite; static floor keys untouched. */
export function applyWaiterBoardLivePatch(
  board: WaiterBoardData,
  live: WaiterBoardLivePatch,
): WaiterBoardData {
  return {
    ...board,
    sessionMetaByTableId: mergeLiveSessionMetaPreservingOpenerNames(
      board.sessionMetaByTableId,
      live.sessionMetaByTableId,
    ),
    checkoutRequestedTableIds: live.checkoutRequestedTableIds,
    checkoutRequestedAtByTableId: live.checkoutRequestedAtByTableId,
    parties: live.parties,
    partyMembers: live.partyMembers,
    tableSummaries: mergeLiveTableSummariesOntoFloor(board.tables, live.tableSummaries),
  };
}

export function parseWaiterBoardFetchScope(value: string | null): WaiterBoardFetchScope {
  return value === 'live' ? 'live' : 'full';
}

/**
 * List active / visibility resume: occupancy catch-up when floor static already
 * hydrated; otherwise one cold full load.
 */
export function resolveWaiterBoardReconcileScope(floorHydrated: boolean): WaiterBoardFetchScope {
  return floorHydrated ? 'live' : 'full';
}
