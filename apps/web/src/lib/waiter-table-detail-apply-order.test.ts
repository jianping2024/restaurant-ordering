import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyOrderUpdateToWaiterDetail } from '@/lib/waiter-table-detail-apply-order';
import type { WaiterTableDetailData } from '@/lib/waiter-table-detail-types';
import type { Order } from '@/types';

function detail(orders: Order[]): WaiterTableDetailData {
  return {
    table: null,
    sessionMeta: null,
    orders,
    checkoutRequested: false,
    checkoutRequestedAt: null,
  };
}

function order(id: string, updatedAt: string): Order {
  return {
    id,
    restaurant_id: 'r1',
    table_id: 't1',
    display_name: 'A1',
    items: [],
    status: 'pending',
    total_amount: 0,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

describe('applyOrderUpdateToWaiterDetail', () => {
  it('replaces an existing order by id', () => {
    const before = detail([order('o1', '2026-01-01T00:00:00.000Z'), order('o2', '2026-01-01T00:00:01.000Z')]);
    const updated = order('o1', '2026-01-01T00:00:02.000Z');
    const next = applyOrderUpdateToWaiterDetail(before, updated);
    assert.equal(next.orders.length, 2);
    assert.equal(next.orders[0]?.updated_at, '2026-01-01T00:00:02.000Z');
    assert.equal(next.orders[1]?.id, 'o2');
  });

  it('appends when the order id is new', () => {
    const before = detail([order('o1', '2026-01-01T00:00:00.000Z')]);
    const updated = order('o2', '2026-01-01T00:00:01.000Z');
    const next = applyOrderUpdateToWaiterDetail(before, updated);
    assert.equal(next.orders.length, 2);
    assert.equal(next.orders[1]?.id, 'o2');
  });

  it('does not mutate the input detail', () => {
    const before = detail([order('o1', '2026-01-01T00:00:00.000Z')]);
    const snapshot = before.orders[0]?.updated_at;
    applyOrderUpdateToWaiterDetail(before, order('o1', '2026-01-01T00:00:02.000Z'));
    assert.equal(before.orders[0]?.updated_at, snapshot);
  });
});
