import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildOptimisticOrderAfterStaffAppend,
  optimisticAppendBatchTotal,
} from '@/lib/staff-order-append-optimistic-patch';
import type { CartItem, Order } from '@/types';

const menuItems = [
  {
    id: 'm1',
    restaurant_id: 'r1',
    name_pt: 'Água',
    price: 2,
    emoji: '💧',
    vat_rate: 23,
    category: 'Bebidas',
    available: true,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    item_code: '001',
  },
];

const cartLine: CartItem = {
  menuItemId: 'm1',
  name_pt: 'Água',
  price: 2,
  emoji: '💧',
  qty: 2,
  note: '',
  notePresetKeys: [],
};

describe('buildOptimisticOrderAfterStaffAppend', () => {
  it('creates a new order when order id is not in detail', () => {
    const order = buildOptimisticOrderAfterStaffAppend({
      orders: [],
      append: { orderId: 'o-new', batchId: 'b1', sessionId: 's1' },
      cart: [cartLine],
      menuItems,
      restaurantId: 'r1',
      tableId: 't1',
      displayName: 'A-04',
      nowIso: '2026-01-01T00:00:01.000Z',
    });
    assert.equal(order.id, 'o-new');
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0]?.qty, 2);
    assert.equal(order.items[0]?.item_code, '001');
    assert.equal(order.total_amount, 4);
  });

  it('merges items into an existing order', () => {
    const existing: Order = {
      id: 'o1',
      restaurant_id: 'r1',
      table_id: 't1',
      session_id: 's1',
      display_name: 'A-04',
      status: 'pending',
      items: [
        {
          id: 'm9',
          name: 'x',
          name_pt: 'x',
          qty: 1,
          price: 3,
          emoji: '🍽',
          item_status: 'pending',
        },
      ],
      total_amount: 3,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const order = buildOptimisticOrderAfterStaffAppend({
      orders: [existing],
      append: { orderId: 'o1', batchId: 'b2', sessionId: 's1' },
      cart: [cartLine],
      menuItems,
      restaurantId: 'r1',
      tableId: 't1',
      displayName: 'A-04',
      nowIso: '2026-01-01T00:00:02.000Z',
    });
    assert.equal(order.items.length, 2);
    assert.equal(order.total_amount, 7);
    assert.equal(order.updated_at, '2026-01-01T00:00:02.000Z');
  });
});

describe('optimisticAppendBatchTotal', () => {
  it('matches cart line totals', () => {
    assert.equal(optimisticAppendBatchTotal([cartLine]), 4);
  });
});
