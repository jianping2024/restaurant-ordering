import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { WaiterBoardData } from './staff-board';
import {
  applyWaiterBoardLivePatch,
  parseWaiterBoardFetchScope,
  resolveWaiterBoardReconcileScope,
  type WaiterBoardLivePatch,
} from './waiter-board-live';

function emptyBoard(overrides: Partial<WaiterBoardData> = {}): WaiterBoardData {
  return {
    sessionMetaByTableId: {},
    checkoutRequestedTableIds: [],
    checkoutRequestedAtByTableId: {},
    tables: [{ id: 't1', display_name: '1', sort_order: 0, seat_min: 1, seat_max: 4 }],
    groups: [
      {
        id: 'g1',
        restaurant_id: 'r1',
        name: 'A',
        remarks: null,
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    members: [{ group_id: 'g1', table_id: 't1', restaurant_id: 'r1' }],
    parties: [],
    partyMembers: [],
    tableSummaries: [],
    restaurantHasActiveBuffets: true,
    openTableDefaults: { buffets: [], buffetPricesByBuffetId: {} },
    ...overrides,
  };
}

describe('waiter-board-live', () => {
  it('parseWaiterBoardFetchScope defaults to full', () => {
    assert.equal(parseWaiterBoardFetchScope(null), 'full');
    assert.equal(parseWaiterBoardFetchScope('full'), 'full');
    assert.equal(parseWaiterBoardFetchScope('live'), 'live');
    assert.equal(parseWaiterBoardFetchScope('other'), 'full');
  });

  it('resolveWaiterBoardReconcileScope uses floor hydration', () => {
    assert.equal(resolveWaiterBoardReconcileScope(false), 'full');
    assert.equal(resolveWaiterBoardReconcileScope(true), 'live');
  });

  it('applyWaiterBoardLivePatch overwrites live keys only', () => {
    const board = emptyBoard({
      checkoutRequestedTableIds: ['old'],
      tableSummaries: [
        {
          tableId: 't1',
          displayName: '1',
          seatMin: 1,
          seatMax: 4,
          buffetHeadcount: null,
          sessionTotal: 0,
          hasBuffet: false,
          occupied: false,
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    });
    const live: WaiterBoardLivePatch = {
      sessionMetaByTableId: {
        t1: {
          sessionId: 's1',
          openedAt: '2026-01-01T00:00:00Z',
          status: 'open',
        },
      },
      checkoutRequestedTableIds: ['t1'],
      checkoutRequestedAtByTableId: { t1: '2026-01-01T01:00:00Z' },
      parties: [
        {
          id: 'p1',
          restaurant_id: 'r1',
          name: 'Party',
          sort_order: 0,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      partyMembers: [{ party_id: 'p1', table_id: 't1', restaurant_id: 'r1' }],
      tableSummaries: [
        {
          tableId: 't1',
          displayName: '1',
          seatMin: 1,
          seatMax: 4,
          buffetHeadcount: null,
          sessionTotal: 10,
          hasBuffet: false,
          occupied: true,
          updatedAt: '2026-01-01T01:00:00Z',
        },
      ],
    };

    const next = applyWaiterBoardLivePatch(board, live);
    assert.equal(next.tables, board.tables);
    assert.equal(next.groups, board.groups);
    assert.equal(next.members, board.members);
    assert.equal(next.openTableDefaults, board.openTableDefaults);
    assert.equal(next.restaurantHasActiveBuffets, true);
    assert.deepEqual(next.checkoutRequestedTableIds, ['t1']);
    assert.equal(next.tableSummaries[0]?.sessionTotal, 10);
    assert.equal(next.parties.length, 1);
    assert.equal(next.sessionMetaByTableId.t1?.sessionId, 's1');
  });
});
