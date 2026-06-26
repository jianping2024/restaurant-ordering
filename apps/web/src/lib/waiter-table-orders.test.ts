import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ordersForWaiterTableView } from '@/lib/waiter-table-orders';
import type { Order } from '@/types';

const TABLE_A = '00000000-0000-4000-8000-000000000001';
const SESSION_REAL = '00000000-0000-4000-8000-000000000002';
const SESSION_OTHER = '00000000-0000-4000-8000-000000000003';

function order(partial: Partial<Order> & Pick<Order, 'id' | 'table_id'>): Order {
  return {
    restaurant_id: 'r1',
    display_name: 'A-06',
    status: 'pending',
    items: [],
    total_amount: 0,
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-01T10:00:00.000Z',
    ...partial,
  };
}

describe('ordersForWaiterTableView', () => {
  it('scopes to real session when present', () => {
    const orders = [
      order({ id: 'o1', table_id: TABLE_A, session_id: SESSION_REAL }),
      order({ id: 'o2', table_id: TABLE_A, session_id: SESSION_OTHER }),
    ];
    const view = ordersForWaiterTableView(TABLE_A, orders, { [TABLE_A]: SESSION_REAL });
    assert.deepEqual(view.map((o) => o.id), ['o1']);
  });

  it('without session, only includes null-session orders for the table', () => {
    const orders = [
      order({ id: 'legacy', table_id: TABLE_A, session_id: null }),
      order({ id: 'bound', table_id: TABLE_A, session_id: SESSION_REAL }),
    ];
    const view = ordersForWaiterTableView(TABLE_A, orders, {});
    assert.deepEqual(view.map((o) => o.id), ['legacy']);
  });
});
