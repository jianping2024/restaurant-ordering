import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateLinesByDish,
  collectStationBoardLines,
  groupBottomRailByStatus,
  groupSelectionFrac,
  lineWaitMinutes,
  partitionStationLines,
  toggleGroupPrepSelection,
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
    prepEligible: true,
    printEligible: false,
    orderedAtMs: Date.parse('2026-08-10T12:00:00.000Z'),
  };
}

describe('groupSelectionFrac', () => {
  it('counts prepEligible order lines only (not qty)', () => {
    const a = stubLine({
      key: 'a',
      tableId: 't1',
      tableDisplay: '90',
      menuItemId: 'm1',
      qty: 9,
    });
    const b = stubLine({
      key: 'b',
      tableId: 't1',
      tableDisplay: '90',
      menuItemId: 'm1',
      qty: 1,
    });
    const c = stubLine({
      key: 'c',
      tableId: 't2',
      tableDisplay: '91',
      menuItemId: 'm1',
      qty: 2,
    });
    const cooking: KitchenBoardLine = {
      ...c,
      key: 'cook',
      prepEligible: false,
      printEligible: true,
      effectiveStatus: 'cooking',
    };
    assert.deepEqual(groupSelectionFrac([a, b, c, cooking], new Set(['a'])), {
      selected: 1,
      total: 3,
      state: 'partial',
    });
    assert.deepEqual(groupSelectionFrac([a, b, c], new Set()), {
      selected: 0,
      total: 3,
      state: 'none',
    });
    assert.deepEqual(groupSelectionFrac([a, b, c], new Set(['a', 'b', 'c'])), {
      selected: 3,
      total: 3,
      state: 'all',
    });
  });

  it('toggleGroupPrepSelection selects then clears prep lines only', () => {
    const a = stubLine({
      key: 'a',
      tableId: 't1',
      tableDisplay: '90',
      menuItemId: 'm1',
      qty: 1,
    });
    const b = stubLine({
      key: 'b',
      tableId: 't1',
      tableDisplay: '90',
      menuItemId: 'm2',
      qty: 1,
    });
    const on = toggleGroupPrepSelection([a, b], new Set());
    assert.deepEqual([...on].sort(), ['a', 'b']);
    const off = toggleGroupPrepSelection([a, b], on);
    assert.equal(off.size, 0);
  });
});

describe('aggregateLinesByDish', () => {
  it('sums portion qty across order lines for the same dish', () => {
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
      stubLine({
        key: 'c',
        tableId: 't2',
        tableDisplay: 'A-02',
        menuItemId: 'm1',
        qty: 3,
        name: 'Chá',
      }),
    ];
    const [agg] = aggregateLinesByDish(lines);
    assert.equal(agg.totalQty, 5);
    assert.equal(agg.lines.length, 3);
    assert.equal(agg.name, 'Chá');
  });
});

describe('lineWaitMinutes', () => {
  it('floors whole minutes since ordered-at', () => {
    const ordered = Date.parse('2026-08-10T12:00:00.000Z');
    assert.equal(lineWaitMinutes(ordered, ordered + 90_000), 1);
    assert.equal(lineWaitMinutes(ordered, ordered + 59_000), 0);
  });
});

describe('partitionStationLines', () => {
  it('keeps pending on workbench and cooking/ready on bottom rail', () => {
    const pending = stubLine({
      key: 'p',
      tableId: 't1',
      tableDisplay: 'A-01',
      menuItemId: 'm1',
      qty: 1,
    });
    const cooking: KitchenBoardLine = {
      ...pending,
      key: 'c',
      effectiveStatus: 'cooking',
      prepEligible: false,
      printEligible: true,
    };
    const ready: KitchenBoardLine = {
      ...pending,
      key: 'r',
      effectiveStatus: 'ready',
      prepEligible: false,
      printEligible: true,
    };
    const { workbench, bottomRail } = partitionStationLines([pending, cooking, ready]);
    assert.equal(workbench.length, 1);
    assert.equal(workbench[0]?.effectiveStatus, 'pending');
    assert.equal(bottomRail.length, 2);
  });
});

describe('groupBottomRailByStatus', () => {
  it('splits cooking then ready and keeps relative order', () => {
    const base = stubLine({
      key: 'p',
      tableId: 't1',
      tableDisplay: 'A-01',
      menuItemId: 'm1',
      qty: 1,
    });
    const c1: KitchenBoardLine = {
      ...base,
      key: 'c1',
      effectiveStatus: 'cooking',
      prepEligible: false,
      printEligible: true,
    };
    const r1: KitchenBoardLine = {
      ...base,
      key: 'r1',
      effectiveStatus: 'ready',
      prepEligible: false,
      printEligible: true,
    };
    const c2: KitchenBoardLine = {
      ...base,
      key: 'c2',
      effectiveStatus: 'cooking',
      prepEligible: false,
      printEligible: true,
    };
    const { cooking, ready } = groupBottomRailByStatus([c1, r1, c2]);
    assert.deepEqual(
      cooking.map((l) => l.key),
      ['c1', 'c2'],
    );
    assert.deepEqual(
      ready.map((l) => l.key),
      ['r1'],
    );
  });
});

describe('collectStationBoardLines', () => {
  it('uses UI language for on-screen dish names', () => {
    const orders: Order[] = [
      {
        id: 'o1',
        restaurant_id: 'r1',
        table_id: 't1',
        display_name: 'A-01',
        session_id: 's1',
        status: 'pending',
        items: [
          {
            id: 'm1',
            name: 'Água 500ml',
            name_pt: 'Água 500ml',
            name_en: 'Water 500ml',
            name_zh: '矿泉水',
            qty: 1,
            price: 1.5,
            emoji: '💧',
            item_status: 'pending',
            print_station_id: 'st1',
            item_code: '001',
          },
        ],
        total_amount: 1.5,
        created_at: '2026-08-10T12:00:00.000Z',
      },
    ];
    const lines = collectStationBoardLines({
      orders,
      printStationId: 'st1',
      nowMs: Date.parse('2026-08-10T12:05:00.000Z'),
      readyAfterMinutes: 8,
      lang: 'zh',
    });
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.displayName, '001 矿泉水');
  });
});
