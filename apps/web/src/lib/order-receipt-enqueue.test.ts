import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit, Order } from '@/types';
import { buildSplitPersonReceiptLines } from './order-receipt-enqueue';

const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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
      { name: 'Guest 1', items: [`${ORDER_ID}-0`] },
      { name: 'Guest 2', items: [`${ORDER_ID}-0`] },
      { name: 'Guest 3', items: [`${ORDER_ID}-0`] },
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
      },
    ],
  },
];

describe('buildSplitPersonReceiptLines', () => {
  it('includes 1/3 share label and per-person price for shared dish', () => {
    const lines = buildSplitPersonReceiptLines(byItemSplit(), 0, orders);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.display_name, 'Coca-Cola');
    assert.equal(lines[0]?.share_qty_label, '1/3');
    assert.equal(lines[0]?.unit_price, 1);
    assert.equal(lines[0]?.qty, 1);
  });

  it('shows full qty when dish is not shared', () => {
    const split = byItemSplit({
      persons: [{ name: 'Guest 1', items: [`${ORDER_ID}-0`] }],
      result: [{ name: 'Guest 1', amount: 3 }],
    });
    const lines = buildSplitPersonReceiptLines(split, 0, orders);
    assert.equal(lines[0]?.share_qty_label, '1');
    assert.equal(lines[0]?.unit_price, 3);
  });

  it('returns empty for even split mode', () => {
    const lines = buildSplitPersonReceiptLines(
      byItemSplit({ split_mode: 'even', persons: [], result: [] }),
      0,
      orders,
    );
    assert.deepEqual(lines, []);
  });
});
