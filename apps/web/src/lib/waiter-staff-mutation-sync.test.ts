import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import type { WaiterBoardData } from '@/lib/staff-board';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import {
  clearAllPublishedWaiterTablePageModels,
  commitAuthoritativeWaiterTablePageModel,
  commitWaiterSessionRelocation,
  mergePublishedModelsIntoWaiterBoard,
  peekPublishedWaiterTablePageModel,
  reconcileWaiterBoardWithPublished,
  releaseWaiterBoardTableBridge,
} from '@/lib/waiter-staff-mutation-sync';

const TABLE_ID = '00000000-0000-4000-8000-000000000004';
const TABLE_B_ID = '00000000-0000-4000-8000-000000000005';

function idleBoard(): WaiterBoardData {
  return {
    sessionMetaByTableId: {},
    checkoutRequestedTableIds: [],
    checkoutRequestedAtByTableId: {},
    tables: [{ id: TABLE_ID, display_name: '004', sort_order: 4, seat_min: 2, seat_max: 4 }],
    groups: [],
    members: [],
    parties: [],
    partyMembers: [],
    tableSummaries: [
      {
        tableId: TABLE_ID,
        displayName: '004',
        buffetHeadcount: null,
        sessionTotal: 0,
        hasBuffet: false,
        occupied: false,
        seatMin: 2,
        seatMax: 4,
        updatedAt: '',
      },
    ],
    restaurantHasActiveBuffets: true,
    openTableDefaults: null,
  };
}

function openTableModel(): WaiterTablePageModel {
  return {
    detail: {
      table: { id: TABLE_ID, display_name: '004', sort_order: 4, seat_min: 2, seat_max: 4 },
      sessionMeta: {
        sessionId: 'sess-1',
        openedAt: '2026-01-01T10:00:00.000Z',
        status: 'open',
      },
      orders: [
        {
          id: 'order-1',
          restaurant_id: 'r1',
          session_id: 'sess-1',
          table_id: TABLE_ID,
          display_name: '004',
          status: 'done',
          items: [
            {
              id: 'b1',
              kind: 'buffet_base',
              name: 'Buffet',
              name_pt: 'Buffet',
              qty: 1,
              price: 39.9,
              emoji: '🍽️',
              adult_count: 2,
              child_count: 0,
              buffet_id: 'buffet-1',
              added_at: '2026-01-01T10:00:00.000Z',
            },
          ],
          total_amount: 39.9,
          created_at: '2026-01-01T10:00:00.000Z',
          updated_at: '2026-01-01T10:00:00.000Z',
        },
      ],
      checkoutRequested: false,
      checkoutRequestedAt: null,
    },
    buffets: [],
    buffetPricesByBuffetId: {},
    inTableParty: false,
  };
}

function boardWithSession(): WaiterBoardData {
  return {
    ...idleBoard(),
    sessionMetaByTableId: {
      [TABLE_ID]: {
        sessionId: 'sess-1',
        openedAt: '2026-01-01T10:00:00.000Z',
        status: 'open',
      },
    },
  };
}

afterEach(() => {
  clearAllPublishedWaiterTablePageModels();
});

describe('waiter-staff-mutation-sync', () => {
  it('commit + peek returns model for table entry bootstrap', () => {
    commitAuthoritativeWaiterTablePageModel(openTableModel());
    const peeked = peekPublishedWaiterTablePageModel(TABLE_ID);
    assert.ok(peeked?.detail.sessionMeta);
    assert.equal(peeked.detail.orders.length, 1);
  });

  it('commit without session clears published bridge', () => {
    commitAuthoritativeWaiterTablePageModel(openTableModel());
    commitAuthoritativeWaiterTablePageModel({
      ...openTableModel(),
      detail: { ...openTableModel().detail, sessionMeta: null },
    });
    assert.equal(peekPublishedWaiterTablePageModel(TABLE_ID), null);
  });

  it('mergePublishedModelsIntoWaiterBoard marks table dining with buffet', () => {
    commitAuthoritativeWaiterTablePageModel(openTableModel());
    const merged = mergePublishedModelsIntoWaiterBoard(idleBoard());
    assert.ok(merged.sessionMetaByTableId[TABLE_ID]);
    const card = merged.tableSummaries.find((row) => row.tableId === TABLE_ID);
    assert.ok(card);
    assert.equal(card.occupied, true);
    assert.equal(card.hasBuffet, true);
    assert.deepEqual(card.buffetHeadcount, { adults: 2, children: 0 });
  });

  it('reconcile keeps published when API board lacks session', () => {
    commitAuthoritativeWaiterTablePageModel(openTableModel());
    const { board, confirmedTableIds } = reconcileWaiterBoardWithPublished(idleBoard());
    assert.ok(board.sessionMetaByTableId[TABLE_ID]);
    assert.deepEqual(confirmedTableIds, []);
    assert.ok(peekPublishedWaiterTablePageModel(TABLE_ID));
  });

  it('reconcile confirms and allows clear when API matches published session', () => {
    commitAuthoritativeWaiterTablePageModel(openTableModel());
    const { board, confirmedTableIds } = reconcileWaiterBoardWithPublished(boardWithSession());
    assert.ok(board.sessionMetaByTableId[TABLE_ID]);
    assert.deepEqual(confirmedTableIds, [TABLE_ID]);
  });

  it('detail-board round trip: commit after detail keeps bootstrap dining on stale SSR', () => {
    commitAuthoritativeWaiterTablePageModel(openTableModel());
    const first = reconcileWaiterBoardWithPublished(idleBoard());
    assert.ok(first.board.sessionMetaByTableId[TABLE_ID]);
    assert.deepEqual(first.confirmedTableIds, []);

    commitAuthoritativeWaiterTablePageModel(openTableModel());
    const boot = mergePublishedModelsIntoWaiterBoard(idleBoard());
    assert.ok(boot.sessionMetaByTableId[TABLE_ID], 'board first frame should be dining');
  });

  it('releaseWaiterBoardTableBridge clears published before checkout refresh', () => {
    commitAuthoritativeWaiterTablePageModel(openTableModel());
    releaseWaiterBoardTableBridge([TABLE_ID]);
    assert.equal(peekPublishedWaiterTablePageModel(TABLE_ID), null);
    const merged = mergePublishedModelsIntoWaiterBoard(idleBoard());
    assert.equal(merged.sessionMetaByTableId[TABLE_ID], undefined);
  });

  it('commitWaiterSessionRelocation clears source and publishes target', () => {
    commitAuthoritativeWaiterTablePageModel(openTableModel());
    const targetModel: WaiterTablePageModel = {
      ...openTableModel(),
      detail: {
        ...openTableModel().detail,
        table: { id: TABLE_B_ID, display_name: '005', sort_order: 5, seat_min: 2, seat_max: 4 },
        orders: openTableModel().detail.orders.map((o) => ({
          ...o,
          table_id: TABLE_B_ID,
          display_name: '005',
        })),
      },
    };
    const affected = commitWaiterSessionRelocation({ sourceTableId: TABLE_ID, targetModel });
    assert.deepEqual(affected, [TABLE_ID, TABLE_B_ID]);
    assert.equal(peekPublishedWaiterTablePageModel(TABLE_ID), null);
    assert.equal(peekPublishedWaiterTablePageModel(TABLE_B_ID)?.detail.table?.id, TABLE_B_ID);
  });

  it('merge skips stale published session after relocation to another table', () => {
    commitAuthoritativeWaiterTablePageModel(openTableModel());
    const apiBoard: WaiterBoardData = {
      ...idleBoard(),
      tables: [
        ...(idleBoard().tables ?? []),
        { id: TABLE_B_ID, display_name: '005', sort_order: 5, seat_min: 2, seat_max: 4 },
      ],
      sessionMetaByTableId: {
        [TABLE_B_ID]: {
          sessionId: 'sess-1',
          openedAt: '2026-01-01T10:00:00.000Z',
          status: 'open',
        },
      },
      tableSummaries: [
        ...(idleBoard().tableSummaries ?? []),
        {
          tableId: TABLE_B_ID,
          displayName: '005',
          buffetHeadcount: { adults: 2, children: 0 },
          sessionTotal: 39.9,
          hasBuffet: true,
          occupied: true,
          seatMin: 2,
          seatMax: 4,
          updatedAt: '',
        },
      ],
    };
    const merged = mergePublishedModelsIntoWaiterBoard(apiBoard);
    assert.equal(merged.sessionMetaByTableId[TABLE_ID], undefined);
    assert.ok(merged.sessionMetaByTableId[TABLE_B_ID]);
    assert.equal(peekPublishedWaiterTablePageModel(TABLE_ID), null);
  });
});
