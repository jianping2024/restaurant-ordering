import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateLinesByDish,
  lineWaitMinutes,
  type KitchenBoardLine,
} from '@/components/kitchen/kitchen-board-lines';
import type { Order, OrderItem } from '@/types';

function stubLine(partial: {
  key: string;
  tableId: string;
  tableDisplay: string;
  menuItemId: string;
  qty: number;
  name?: string;
}): KitchenBoardLine {
  const item = {
    id: partial.menuItemId,
    name: partial.name || 'Dish',
    qty: partial.qty,
  } as OrderItem;
  const order = {
    id: `o-${partial.key}`,
    table_id: partial.tableId,
    display_name: partial.tableDisplay,
    created_at: '2026-08-10T12:00:00.000Z',
    items: [item],
  } as Order;
  return {
    key: partial.key,
    orderId: order.id,
    itemIndex: 0,
    order,
    item,
    tableId: partial.tableId,
    tableDisplay: partial.tableDisplay,
    menuItemId: partial.menuItemId,
    itemCode: null,
    displayName: partial.name || 'Dish',
    effectiveStatus: 'pending',
    selectable: true,
    orderedAtMs: Date.parse('2026-08-10T12:00:00.000Z'),
  };
}

describe('aggregateLinesByDish', () => {
  it('counts unique tables, not repeated same-table lines', () => {
    const lines = [
      stubLine({
        key: 'a',
        tableId: 't1',
        tableDisplay: 'A-01',
        menuItemId: 'm1',
        qty: 1,
        name: 'Chá',
      }),
      stubLine({
        key: 'b',
        tableId: 't1',
        tableDisplay: 'A-01',
        menuItemId: 'm1',
        qty: 1,
        name: 'Chá',
      }),
    ];
    const [agg] = aggregateLinesByDish(lines);
    assert.equal(agg.tableCount, 1);
    assert.equal(agg.totalQty, 2);
    assert.deepEqual(agg.tableDisplays, ['A-01']);
    assert.equal(agg.lines.length, 2);
  });
});

describe('lineWaitMinutes', () => {
  it('floors whole minutes since ordered-at', () => {
    const ordered = Date.parse('2026-08-10T12:00:00.000Z');
    assert.equal(lineWaitMinutes(ordered, ordered + 90_000), 1);
    assert.equal(lineWaitMinutes(ordered, ordered + 59_000), 0);
  });
});
