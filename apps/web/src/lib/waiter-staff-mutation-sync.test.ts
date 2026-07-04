import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import type { WaiterBoardData } from '@/lib/staff-board';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import {
  clearAllPublishedWaiterTablePageModels,
  mergePublishedModelsIntoWaiterBoard,
  peekPublishedWaiterTablePageModel,
  publishWaiterTablePageModel,
} from '@/lib/waiter-staff-mutation-sync';

const TABLE_ID = '00000000-0000-4000-8000-000000000004';

function idleBoard(): WaiterBoardData {
  return {
    sessionMetaByTableId: {},
    checkoutRequestedTableIds: [],
    checkoutRequestedAtByTableId: {},
    tables: [{ id: TABLE_ID, display_name: '004', sort_order: 4 }],
    groups: [],
    members: [],
    tableSummaries: [
      {
        tableId: TABLE_ID,
        displayName: '004',
        guestCount: 0,
        sessionTotal: 0,
        hasBuffet: false,
        occupied: false,
        updatedAt: '',
      },
    ],
  };
}

function openTableModel(): WaiterTablePageModel {
  return {
    detail: {
      table: { id: TABLE_ID, display_name: '004', sort_order: 4 },
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
  };
}

afterEach(() => {
  clearAllPublishedWaiterTablePageModels();
});

describe('waiter-staff-mutation-sync', () => {
  it('publish + peek returns model for table entry bootstrap', () => {
    publishWaiterTablePageModel(openTableModel());
    const peeked = peekPublishedWaiterTablePageModel(TABLE_ID);
    assert.ok(peeked?.detail.sessionMeta);
    assert.equal(peeked.detail.orders.length, 1);
  });

  it('mergePublishedModelsIntoWaiterBoard marks table dining with buffet', () => {
    publishWaiterTablePageModel(openTableModel());
    const merged = mergePublishedModelsIntoWaiterBoard(idleBoard());
    assert.ok(merged.sessionMetaByTableId[TABLE_ID]);
    const card = merged.tableSummaries.find((row) => row.tableId === TABLE_ID);
    assert.ok(card);
    assert.equal(card.occupied, true);
    assert.equal(card.hasBuffet, true);
    assert.equal(card.guestCount, 2);
  });
});
