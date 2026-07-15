import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBillableSessionItems } from '@/lib/billable-session-lines';
import { checkoutLinesFromOrders } from '@/lib/checkout-session-lines';
import type { Order } from '@/types';

describe('buildBillableSessionItems', () => {
  it('aggregates active buffet lines and merges menu items', () => {
    const orders = [
      {
        id: 'o1',
        items: [
          {
            id: 'buffet:1',
            kind: 'buffet_base',
            name: 'Buffet livre',
            name_pt: 'Buffet livre',
            qty: 1,
            price: 55.9,
            emoji: '🍽️',
            adult_count: 1,
            child_count: 0,
            buffet_id: 'b1',
          },
          {
            id: 'd1',
            name: 'Sumol',
            name_pt: 'Sumol',
            qty: 1,
            price: 2,
            emoji: '🥤',
          },
        ],
      },
    ] as Order[];

    const items = buildBillableSessionItems(orders);
    assert.equal(items.length, 2);
    assert.equal(items[0]?.item.adult_count, 1);
    assert.equal(items[1]?.item.qty, 1);
  });

  it('skips voided buffet history lines', () => {
    const orders = [
      {
        id: 'o1',
        items: [
          {
            id: 'buffet:old',
            kind: 'buffet_base',
            name: 'Buffet livre',
            name_pt: 'Buffet livre',
            qty: 1,
            price: 40,
            adult_count: 2,
            child_count: 0,
            buffet_id: 'b1',
            item_status: 'voided',
          },
          {
            id: 'buffet:new',
            kind: 'buffet_base',
            name: 'Buffet livre',
            name_pt: 'Buffet livre',
            qty: 1,
            price: 55.9,
            adult_count: 1,
            child_count: 0,
            buffet_id: 'b1',
          },
        ],
      },
    ] as Order[];

    const items = buildBillableSessionItems(orders);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.item.adult_count, 1);
    assert.equal(items[0]?.item.price, 55.9);
  });
});

describe('checkoutLinesFromOrders', () => {
  it('shows buffet headcount as A1-C2 receipt tokens instead of menu qty', () => {
    const orders = [
      {
        id: 'o1',
        items: [
          {
            id: 'buffet:1',
            kind: 'buffet_base',
            name: 'Buffet livre',
            name_pt: 'Buffet livre',
            qty: 1,
            price: 55.9,
            emoji: '🍽️',
            adult_count: 1,
            child_count: 2,
            buffet_id: 'b1',
          },
        ],
      },
    ] as Order[];

    const lines = checkoutLinesFromOrders(orders);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.quantityLabel, '· A1-C2');
    assert.equal(lines[0]?.lineTotal, 55.9);
  });

  it('merges repeated menu items with the same unit price', () => {
    const orders = [
      {
        id: 'o1',
        items: [
          {
            id: 'd1',
            name: 'Água 500ml',
            name_pt: 'Água 500ml',
            qty: 1,
            price: 1.85,
            emoji: '💧',
          },
        ],
      },
      {
        id: 'o2',
        items: [
          {
            id: 'd1',
            name: 'Água 500ml',
            name_pt: 'Água 500ml',
            qty: 1,
            price: 1.85,
            emoji: '💧',
          },
          {
            id: 'd1',
            name: 'Água 500ml',
            name_pt: 'Água 500ml',
            qty: 1,
            price: 1.85,
            emoji: '💧',
          },
        ],
      },
    ] as Order[];

    const lines = checkoutLinesFromOrders(orders);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.quantityLabel, '× 3');
    assert.ok(Math.abs((lines[0]?.lineTotal ?? 0) - 5.55) < 0.001);
  });
});
