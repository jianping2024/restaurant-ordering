import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  snapshotToDetailData,
  snapshotToPageModel,
  type WaiterTableDetailSnapshot,
} from '@/lib/waiter-table-detail-snapshot';
import { defaultBuffetPriceFromModel } from '@/lib/waiter-table-detail-normalize';

const table = { id: 't1', display_name: '002', sort_order: 2 };

describe('waiter-table-detail-view', () => {
  it('maps idle snapshot to page model with default buffet price', () => {
    const snapshot: WaiterTableDetailSnapshot = {
      kind: 'idle',
      table,
      buffets: [{ id: 'b1', name: 'Buffet', is_active: true } as never],
      buffetPricesByBuffetId: {
        b1: { adult_price: 19.95, child_price: 10, rule_id: 'r1', time_slot_id: 's1' },
      },
    };

    const detail = snapshotToDetailData(snapshot);
    assert.equal(detail.table?.display_name, '002');
    assert.equal(detail.sessionMeta, null);
    assert.deepEqual(detail.orders, []);
    assert.equal(detail.checkoutRequested, false);

    const model = snapshotToPageModel(snapshot);
    assert.equal(defaultBuffetPriceFromModel(model)?.adult_price, 19.95);
    assert.equal(model.buffets.length, 1);
    assert.equal(model.inTableParty, false);
  });

  it('maps active snapshot to full detail', () => {
    const snapshot: WaiterTableDetailSnapshot = {
      kind: 'active',
      table,
      buffets: [],
      sessionMeta: { sessionId: 's1', openedAt: '2026-01-01T12:00:00Z', status: 'open' },
      orders: [{ id: 'o1' } as never],
      checkoutRequested: true,
      checkoutRequestedAt: '2026-01-01T13:00:00Z',
      buffetPricesByBuffetId: {},
    };

    const detail = snapshotToDetailData(snapshot);
    assert.equal(detail.sessionMeta?.sessionId, 's1');
    assert.equal(detail.orders.length, 1);
    assert.equal(detail.checkoutRequested, true);
  });
});
