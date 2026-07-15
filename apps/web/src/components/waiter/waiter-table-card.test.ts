import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildWaiterTableCard } from './waiter-table-card';
import type { Order } from '@/types';

function orderWithTotal(total_amount: number, id = 'o1'): Order {
  return {
    id,
    restaurant_id: 'r1',
    table_id: 't1',
    display_name: '001',
    status: 'pending',
    items: [],
    total_amount,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('buildWaiterTableCard', () => {
  it('sets sessionTotal from persisted order.total_amount', () => {
    const card = buildWaiterTableCard('t1', '001', [
      orderWithTotal(12.5, 'o1'),
      orderWithTotal(8, 'o2'),
    ]);
    assert.equal(card.sessionTotal, 20.5);
  });

  it('returns zero sessionTotal for empty orders', () => {
    const card = buildWaiterTableCard('t1', '001', []);
    assert.equal(card.sessionTotal, 0);
  });
});
