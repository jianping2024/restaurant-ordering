import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit, Order } from '@/types';
import {
  buildCheckoutPersonShareLines,
  buildSplitPersonShareLines,
} from './checkout-split-person-lines';

const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MENU_KEY = 'menu-coke::3';

function byItemSplit(overrides: Partial<BillSplit> = {}): BillSplit {
  return {
    id: 'split-1',
    restaurant_id: 'rest-1',
    session_id: 'sess-1',
    table_id: 'table-1',
    display_name: 'A-01',
    order_ids: [ORDER_ID],
    split_mode: 'by_item',
    persons: [
      {
        name: 'Guest 1',
        item_shares: [{ key: MENU_KEY, qty_num: 1, qty_den: 3 }],
      },
      {
        name: 'Guest 2',
        item_shares: [{ key: MENU_KEY, qty_num: 1, qty_den: 3 }],
      },
      {
        name: 'Guest 3',
        item_shares: [{ key: MENU_KEY, qty_num: 1, qty_den: 3 }],
      },
    ],
    result: [
      { name: 'Guest 1', amount: 1 },
      { name: 'Guest 2', amount: 1 },
      { name: 'Guest 3', amount: 1 },
    ],
    total_amount: 3,
    status: 'requested',
    created_at: '2026-06-22T00:00:00.000Z',
    ...overrides,
  };
}

const orders: Order[] = [
  {
    id: ORDER_ID,
    restaurant_id: 'rest-1',
    table_id: 'table-1',
    display_name: 'A-01',
    session_id: 'sess-1',
    status: 'done',
    total_amount: 3,
    created_at: '2026-06-22T00:00:00.000Z',
    updated_at: '2026-06-22T00:00:00.000Z',
    items: [
      {
        id: 'menu-coke',
        name: 'Coke',
        name_pt: 'Coca-Cola',
        qty: 1,
        price: 3,
        emoji: '🥤',
        item_code: '028',
        category_code_path: ['RE'],
      },
    ],
  },
];

describe('buildSplitPersonShareLines', () => {
  it('returns share qty and amount for by_item person', () => {
    const lines = buildSplitPersonShareLines(byItemSplit(), 0, orders);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.key, MENU_KEY);
    assert.equal(lines[0]?.quantityLabel, '1/3');
    assert.equal(lines[0]?.shareAmount, 1);
  });

  it('returns empty for even split', () => {
    const lines = buildSplitPersonShareLines(
      byItemSplit({
        split_mode: 'even',
        persons: [{ name: 'A' }],
        result: [{ name: 'A', amount: 3 }],
      }),
      0,
      orders,
    );
    assert.deepEqual(lines, []);
  });
});

describe('buildCheckoutPersonShareLines', () => {
  it('uses staff menu-code label from order snapshot', () => {
    const lines = buildCheckoutPersonShareLines(byItemSplit(), 0, orders);
    assert.equal(lines.length, 1);
    assert.match(lines[0]?.label ?? '', /028/);
    assert.equal(lines[0]?.quantityLabel, '1/3');
    assert.equal(lines[0]?.shareAmount, 1);
  });
});
