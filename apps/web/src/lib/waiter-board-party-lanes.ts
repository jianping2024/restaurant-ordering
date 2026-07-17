import {
  membersForParty,
  sortTablePartyGroups,
  type TablePartyGroup,
  type TablePartyGroupMember,
} from '@/lib/table-party-groups';
import {
  classifyWaiterTableBoardState,
  type WaiterBoardFilter,
  type WaiterBoardStateContext,
  type WaiterTableSessionMeta,
} from '@/lib/waiter-board-session';
import {
  sortWaiterBoardTableSummaries,
  type WaiterBoardTableSummary,
} from '@/lib/waiter-board-snapshot';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

export type WaiterBoardPartyLane = {
  party: TablePartyGroup;
  cards: WaiterBoardTableSummary[];
  checkoutCount: number;
  memberCount: number;
};

/** Same visibility rules as the former vertical party list on the waiter board. */
export function buildVisibleWaiterBoardPartyLanes(input: {
  parties: readonly TablePartyGroup[];
  partyMembers: readonly TablePartyGroupMember[];
  tables: readonly RestaurantTableRow[];
  summaryByTableId: ReadonlyMap<string, WaiterBoardTableSummary>;
  boardFilter: WaiterBoardFilter;
  boardStateContext: WaiterBoardStateContext;
  checkoutRequestedTableIds: readonly string[];
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>;
  tableSearchTrimmed: string;
  tableMatchesSearch: (displayName: string, q: string) => boolean;
}): WaiterBoardPartyLane[] {
  const {
    parties,
    partyMembers,
    tables,
    summaryByTableId,
    boardFilter,
    boardStateContext,
    checkoutRequestedTableIds,
    sessionMetaByTableId,
    tableSearchTrimmed,
    tableMatchesSearch,
  } = input;

  return sortTablePartyGroups([...parties])
    .map((party) => {
      const memberIds = membersForParty(partyMembers, party.id).map((m) => m.table_id);
      let cards = memberIds
        .map((id) => summaryByTableId.get(id))
        .filter((card): card is WaiterBoardTableSummary => !!card);

      if (boardFilter !== 'all') {
        cards = cards.filter(
          (card) => classifyWaiterTableBoardState(card.tableId, boardStateContext) === boardFilter,
        );
      }
      if (tableSearchTrimmed) {
        cards = cards.filter((card) =>
          tableMatchesSearch(card.displayName, tableSearchTrimmed),
        );
      }

      cards = sortWaiterBoardTableSummaries(
        cards,
        tables,
        checkoutRequestedTableIds,
        sessionMetaByTableId,
      );

      const checkoutCount = memberIds.filter(
        (id) => classifyWaiterTableBoardState(id, boardStateContext) === 'checkout',
      ).length;

      return { party, cards, checkoutCount, memberCount: memberIds.length };
    })
    .filter((row) => {
      if (boardFilter === 'all' && !tableSearchTrimmed) return true;
      return row.cards.length > 0;
    });
}
