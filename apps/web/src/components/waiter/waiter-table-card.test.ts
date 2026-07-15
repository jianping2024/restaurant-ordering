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

  it('formats menu lines as code plus plain name without emoji', () => {
    const card = buildWaiterTableCard(
      't1',
      '001',
      [
        {
          id: 'o1',
          restaurant_id: 'r1',
          table_id: 't1',
          display_name: '001',
          status: 'pending',
          items: [
            {
              id: 'd1',
              name: 'Água 500ml',
              name_pt: 'Água 500ml',
              qty: 1,
              price: 1.85,
              emoji: '💧',
              item_code: '001',
            },
          ],
          total_amount: 1.85,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    );
    assert.equal(card.orderLines.length, 1);
    assert.equal(card.orderLines[0]?.label, '001 Água 500ml');
    assert.equal(card.orderLines[0]?.quantityLabel, '× 1');
  });

  it('formats buffet lines without emoji', () => {
    const card = buildWaiterTableCard('t1', '001', [
      {
        id: 'o1',
        restaurant_id: 'r1',
        table_id: 't1',
        display_name: '001',
        status: 'pending',
        items: [
          {
            id: 'buffet:1',
            kind: 'buffet_base',
            name: 'Buffet livre',
            name_pt: 'Buffet livre',
            qty: 1,
            price: 55.9,
            emoji: '🍽️',
            adult_count: 2,
            child_count: 1,
            buffet_id: 'b1',
          },
        ],
        total_amount: 55.9,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    assert.equal(card.orderLines.length, 1);
    assert.equal(card.orderLines[0]?.label, 'Buffet livre · A2-C1');
  });

  it('merges identical menu lines with the billable catalog key (ignores notes)', () => {
    const card = buildWaiterTableCard(
      't1',
      '001',
      [
        {
          id: 'o1',
          restaurant_id: 'r1',
          table_id: 't1',
          display_name: '001',
          status: 'pending',
          items: [
            {
              id: 'd1',
              name: 'Água 500ml',
              name_pt: 'Água 500ml',
              qty: 1,
              price: 1.85,
              emoji: '💧',
              item_code: '001',
              note: 'cold',
            },
            {
              id: 'd1',
              name: 'Água 500ml',
              name_pt: 'Água 500ml',
              qty: 1,
              price: 1.85,
              emoji: '💧',
              item_code: '001',
              note: 'room',
            },
          ],
          total_amount: 3.7,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'o2',
          restaurant_id: 'r1',
          table_id: 't1',
          display_name: '001',
          status: 'cooking',
          items: [
            {
              id: 'd1',
              name: 'Água 500ml',
              name_pt: 'Água 500ml',
              qty: 1,
              price: 1.85,
              emoji: '💧',
              item_code: '001',
            },
          ],
          total_amount: 1.85,
          created_at: '2026-01-01T00:01:00.000Z',
          updated_at: '2026-01-01T00:01:00.000Z',
        },
      ],
      {},
      'frontdesk_staff',
    );

    assert.equal(card.orderLines.length, 1);
    assert.equal(card.orderLines[0]?.label, '001 Água 500ml');
    assert.equal(card.orderLines[0]?.quantityLabel, '× 3');
    assert.equal(card.orderLines[0]?.canDecrement, true);
    assert.equal(card.orderLines[0]?.orderId, 'o1');
    assert.equal(card.orderLines[0]?.itemIdx, 0);
  });

  it('keeps menu lines separate when unit price differs', () => {
    const card = buildWaiterTableCard('t1', '001', [
      {
        id: 'o1',
        restaurant_id: 'r1',
        table_id: 't1',
        display_name: '001',
        status: 'pending',
        items: [
          {
            id: 'd1',
            name: 'Água 500ml',
            name_pt: 'Água 500ml',
            qty: 1,
            price: 1.85,
            emoji: '💧',
            item_code: '001',
          },
          {
            id: 'd1',
            name: 'Água 500ml',
            name_pt: 'Água 500ml',
            qty: 1,
            price: 2.0,
            emoji: '💧',
            item_code: '001',
          },
        ],
        total_amount: 3.85,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    assert.equal(card.orderLines.length, 2);
    assert.equal(card.orderLines[0]?.quantityLabel, '× 1');
    assert.equal(card.orderLines[1]?.quantityLabel, '× 1');
  });

  it('prefers a decrementable qty>1 row as the action target on a merged group', () => {
    const card = buildWaiterTableCard(
      't1',
      '001',
      [
        {
          id: 'o1',
          restaurant_id: 'r1',
          table_id: 't1',
          display_name: '001',
          status: 'pending',
          items: [
            {
              id: 'd1',
              name: 'Cola',
              name_pt: 'Cola',
              qty: 1,
              price: 2,
              emoji: '🥤',
              item_code: '010',
            },
          ],
          total_amount: 2,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'o2',
          restaurant_id: 'r1',
          table_id: 't1',
          display_name: '001',
          status: 'pending',
          items: [
            {
              id: 'd1',
              name: 'Cola',
              name_pt: 'Cola',
              qty: 2,
              price: 2,
              emoji: '🥤',
              item_code: '010',
            },
          ],
          total_amount: 4,
          created_at: '2026-01-01T00:01:00.000Z',
          updated_at: '2026-01-01T00:01:00.000Z',
        },
      ],
      {},
      'frontdesk_staff',
    );

    assert.equal(card.orderLines.length, 1);
    assert.equal(card.orderLines[0]?.quantityLabel, '× 3');
    assert.equal(card.orderLines[0]?.orderId, 'o2');
    assert.equal(card.orderLines[0]?.itemIdx, 0);
    assert.equal(card.orderLines[0]?.canDecrement, true);
  });
});
