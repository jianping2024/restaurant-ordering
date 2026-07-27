import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { freezeBillingLinesOnOrders } from '@/lib/session-billing-freeze';
import type { Order, OrderItem } from '@/types';

function order(items: OrderItem[]): Order {
  return {
    id: 'o1',
    restaurant_id: 'r1',
    session_id: 's1',
    table_id: 't1',
    display_name: 'A1',
    status: 'pending',
    items,
    total_amount: 0,
    created_at: '',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('freezeBillingLinesOnOrders', () => {
  it('splits limited lines into free + chargeable rows for close-time freeze', () => {
    const frozen = freezeBillingLinesOnOrders([
      order([
        {
          id: 'buffet:b1',
          kind: 'buffet_base',
          buffet_id: 'b1',
          adult_count: 1,
          child_count: 0,
          name: 'Buffet',
          name_pt: 'Buffet',
          qty: 1,
          price: 17.95,
          emoji: '',
          item_status: 'done',
        },
        {
          id: 'm1',
          name: 'susi',
          name_pt: 'susi',
          qty: 4,
          price: 0,
          emoji: '',
          per_person_qty_limit: 2,
          over_limit_unit_price: 4.5,
          added_at: '2026-01-01T00:00:00.000Z',
          item_status: 'pending',
          batch_id: 'b',
        },
      ]),
    ]);

    const menu = frozen[0].items.filter((item) => item.id === 'm1');
    assert.deepEqual(
      menu.map((item) => ({ qty: item.qty, price: item.price, batch_id: item.batch_id })),
      [
        { qty: 2, price: 0, batch_id: 'b' },
        { qty: 2, price: 4.5, batch_id: 'b' },
      ],
    );
  });

  it('is a no-op when no limited rule snapshots are present', () => {
    const input = [
      order([
        {
          id: 'm1',
          name: 'susi',
          name_pt: 'susi',
          qty: 4,
          price: 0,
          emoji: '',
          item_status: 'pending',
        },
      ]),
    ];
    const frozen = freezeBillingLinesOnOrders(input);
    assert.equal(frozen, input);
  });
});
