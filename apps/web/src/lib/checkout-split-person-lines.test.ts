import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit, Order } from '@/types';
import { limitedBillableMergeKey } from '@/lib/billable-session-lines';
import {
  buildCheckoutPersonShareLines,
  buildSplitPersonShareLines,
} from './checkout-split-person-lines';

const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MENU_KEY = 'menu-coke::3';
const LIMITED_KEY = limitedBillableMergeKey('m1');

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
    const lines = buildSplitPersonShareLines(byItemSplit(), 0, orders, 'pt');
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
      'pt',
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

const limitedSushiOrders: Order[] = [
  {
    id: ORDER_ID,
    restaurant_id: 'rest-1',
    table_id: 'table-1',
    display_name: 'A-05',
    session_id: 'sess-1',
    status: 'done',
    total_amount: 23.95,
    created_at: '2026-06-22T00:00:00.000Z',
    updated_at: '2026-06-22T00:00:00.000Z',
    items: [
      {
        id: 'buffet:b1',
        kind: 'buffet_base',
        buffet_id: 'b1',
        adult_count: 1,
        child_count: 0,
        adult_unit_price: 14.95,
        child_unit_price: 9.5,
        name: 'Buffet',
        name_pt: 'Buffet',
        qty: 1,
        price: 14.95,
        emoji: '',
        item_status: 'done',
      },
      {
        id: 'm1',
        name: 'susi1',
        name_pt: 'susi1',
        qty: 4,
        price: 0,
        emoji: '',
        per_person_qty_limit: 2,
        over_limit_unit_price: 4.5,
        added_at: '2026-01-01T00:00:00.000Z',
        item_status: 'pending',
      },
    ],
  },
];

describe('limited sushi by_item person shares', () => {
  it('uses chargeable line total (not physical qty × menu price)', () => {
    const split: BillSplit = {
      id: 'split-limited',
      restaurant_id: 'rest-1',
      session_id: 'sess-1',
      table_id: 'table-1',
      display_name: 'A-05',
      order_ids: [ORDER_ID],
      split_mode: 'by_item',
      persons: [
        {
          name: 'John',
          item_shares: [
            { key: LIMITED_KEY, qty_num: 2, qty_den: 1 },
            { key: 'buffet:b1', qty_num: 1, qty_den: 1, guest_type: 'adult' },
          ],
        },
      ],
      result: [{ name: 'John', amount: 23.95 }],
      total_amount: 23.95,
      status: 'requested',
      created_at: '2026-06-22T00:00:00.000Z',
    };

    const lines = buildSplitPersonShareLines(split, 0, limitedSushiOrders, 'pt');
    const sushi = lines.find((line) => line.key === LIMITED_KEY);
    assert.ok(sushi);
    assert.equal(sushi?.shareAmount, 9);
    assert.equal(sushi?.quantityLabel, '2');
  });
});
