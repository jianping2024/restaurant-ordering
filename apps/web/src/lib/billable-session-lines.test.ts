import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBillableSessionItems,
  byItemSplitTargetQty,
  chargeableFieldsFromBillableRow,
  isByItemSplittableBillableRow,
  isLimitedBillableRow,
  limitedBillableMergeKey,
  menuItemIdFromLimitedBillableKey,
  sortOrdersForBillableCatalog,
  sumBillableNonBuffetTotal,
  sumBillableSessionTotal,
} from '@/lib/billable-session-lines';
import { buildBillSplitOrderLines } from '@/lib/bill-split-by-item-lines';
import { sumLineTotals } from '@/lib/cart-totals';
import { computeOrderTotalsFromItems } from '@/lib/order-item-void/persist-order-items-update';
import type { Order, OrderItem } from '@/types';

describe('limited billable merge keys', () => {
  it('round-trips menu item ids through limited merge keys', () => {
    const key = limitedBillableMergeKey('m1');
    assert.equal(isLimitedBillableRow({ key }), true);
    assert.equal(menuItemIdFromLimitedBillableKey(key), 'm1');
    assert.equal(menuItemIdFromLimitedBillableKey('d1::2'), null);
  });

  it('exports chargeable metadata only when a share exists', () => {
    assert.deepEqual(
      chargeableFieldsFromBillableRow({ chargeableQty: 2, chargeableUnitPrice: 4.5 }),
      { chargeableQty: 2, chargeableUnitPrice: 4.5 },
    );
    assert.deepEqual(chargeableFieldsFromBillableRow({}), {});
  });

  it('byItemSplitTargetQty uses chargeable share for limited rows', () => {
    const limitedKey = limitedBillableMergeKey('m1');
    assert.equal(
      byItemSplitTargetQty({
        key: limitedKey,
        item: { id: 'm1', name: 's', name_pt: 's', qty: 4, price: 0, emoji: '' },
        chargeableQty: 2,
      }),
      2,
    );
    assert.equal(
      byItemSplitTargetQty({
        key: limitedKey,
        item: { id: 'm1', name: 's', name_pt: 's', qty: 4, price: 0, emoji: '' },
      }),
      0,
    );
    assert.equal(
      isByItemSplittableBillableRow({
        key: limitedKey,
        item: { id: 'm1', name: 's', name_pt: 's', qty: 4, price: 0, emoji: '' },
      }),
      false,
    );
  });
});

describe('sumBillableSessionTotal', () => {
  it('sums active billable lines across orders', () => {
    const orders = [
      {
        id: 'o1',
        status: 'pending',
        items: [
          { id: 'd1', name: 'Água', name_pt: 'Água', qty: 2, price: 1.5, emoji: '💧' },
        ],
      },
      {
        id: 'o2',
        status: 'cooking',
        items: [
          { id: 'd2', name: 'Cola', name_pt: 'Cola', qty: 1, price: 2, emoji: '🥤' },
        ],
      },
    ] as Order[];

    assert.equal(sumBillableSessionTotal(orders), 5);
    assert.equal(sumBillableNonBuffetTotal(orders), 5);
  });

  it('sums non-buffet lines only for meals total', () => {
    const orders = [
      {
        id: 'o1',
        status: 'pending',
        items: [
          {
            id: 'buffet:b1',
            kind: 'buffet_base',
            buffet_id: 'b1',
            adult_count: 2,
            child_count: 0,
            adult_unit_price: 17.95,
            child_unit_price: 10,
            name: 'Buffet',
            name_pt: 'Buffet',
            qty: 1,
            price: 35.9,
            emoji: '',
            item_status: 'done',
          },
          {
            id: 'd1',
            name: 'Água',
            name_pt: 'Água',
            qty: 2,
            price: 1.5,
            emoji: '💧',
            item_status: 'pending',
          },
        ],
      },
    ] as Order[];

    assert.equal(sumBillableSessionTotal(orders), 38.9);
    assert.equal(sumBillableNonBuffetTotal(orders), 3);
  });

  it('excludes kitchen_remake lines from payable totals', () => {
    const orders = [
      {
        id: 'o1',
        status: 'pending',
        items: [
          { id: 'd1', name: 'Água', name_pt: 'Água', qty: 1, price: 2, emoji: '💧' },
          {
            id: 'd1',
            name: 'Água remake',
            name_pt: 'Água remake',
            qty: 1,
            price: 0,
            emoji: '💧',
            kitchen_remake: true,
          },
        ],
      },
    ] as Order[];

    assert.equal(sumBillableSessionTotal(orders), 2);
    assert.equal(buildBillableSessionItems(orders).length, 1);
  });

  it('excludes voided lines (matches bill details after decrement + append)', () => {
    const voided: OrderItem = {
      id: 'd1',
      name: 'Água',
      name_pt: 'Água',
      qty: 1,
      price: 10,
      emoji: '💧',
      item_status: 'voided',
    };
    const fresh: OrderItem = {
      id: 'd2',
      name: 'Cola',
      name_pt: 'Cola',
      qty: 1,
      price: 3,
      emoji: '🥤',
    };
    const prior = [voided];
    const merged = [...prior, fresh];
    const { total_amount } = computeOrderTotalsFromItems(merged, 'pending');

    assert.equal(total_amount, 3);
    assert.equal(
      sumBillableSessionTotal([
        {
          id: 'o1',
          status: 'pending',
          items: merged,
          total_amount,
        } as Order,
      ]),
      3,
    );
  });

  it('derives sushi chargeable share without rewriting stored lines', () => {
    const orders = [
      {
        id: 'o1',
        restaurant_id: 'r1',
        session_id: 's1',
        table_id: 't1',
        display_name: 'A1',
        status: 'pending',
        total_amount: 17.95,
        created_at: '',
        updated_at: '',
        items: [
          {
            id: 'buffet:b1',
            kind: 'buffet_base',
            buffet_id: 'b1',
            adult_count: 2,
            child_count: 0,
            adult_unit_price: 17.95,
            child_unit_price: 10,
            name: 'Buffet livre',
            name_pt: 'Buffet livre',
            qty: 1,
            price: 35.9,
            emoji: '',
            item_status: 'done',
          },
          {
            id: 'm1',
            name: 'susi1',
            name_pt: 'susi1',
            qty: 5,
            price: 0,
            emoji: '',
            per_person_qty_limit: 2,
            over_limit_unit_price: 4.5,
            added_at: '2026-01-01T00:00:00.000Z',
            item_status: 'pending',
          },
        ],
      },
    ] as Order[];

    const lines = buildBillableSessionItems(orders);
    const menu = lines.filter((row) => row.item.id === 'm1');
    assert.equal(menu.length, 1);
    assert.deepEqual(
      {
        qty: menu[0].item.qty,
        price: menu[0].item.price,
        chargeableQty: menu[0].chargeableQty,
        chargeableUnitPrice: menu[0].chargeableUnitPrice,
      },
      {
        qty: 5,
        price: 0,
        chargeableQty: 1,
        chargeableUnitPrice: 4.5,
      },
    );
    assert.equal(sumBillableSessionTotal(orders), 35.9 + 4.5);
    assert.notEqual(sumLineTotals(buildBillSplitOrderLines(orders)), 35.9 + 4.5);
    assert.equal(orders[0].items[1].qty, 5);
    assert.equal(orders[0].items[1].price, 0);
  });

  it('bills zero for fully free limited rows when menu price is non-zero', () => {
    const orders = [
      {
        id: 'o1',
        status: 'pending',
        items: [
          {
            id: 'buffet:b1',
            kind: 'buffet_base',
            buffet_id: 'b1',
            adult_count: 2,
            child_count: 0,
            adult_unit_price: 17.95,
            child_unit_price: 10,
            name: 'Buffet',
            name_pt: 'Buffet',
            qty: 1,
            price: 35.9,
            emoji: '',
            item_status: 'done',
          },
          {
            id: 'm1',
            name: 'susi1',
            name_pt: 'susi1',
            qty: 3,
            price: 1.5,
            emoji: '',
            per_person_qty_limit: 2,
            over_limit_unit_price: 4.5,
            added_at: '2026-01-01T00:00:00.000Z',
            item_status: 'pending',
          },
        ],
      },
    ] as Order[];

    assert.equal(sumBillableSessionTotal(orders), 35.9);
  });

  it('bills only chargeable qty at overage price when menu price is non-zero', () => {
    const orders = [
      {
        id: 'o1',
        status: 'pending',
        items: [
          {
            id: 'buffet:b1',
            kind: 'buffet_base',
            buffet_id: 'b1',
            adult_count: 2,
            child_count: 0,
            adult_unit_price: 17.95,
            child_unit_price: 10,
            name: 'Buffet',
            name_pt: 'Buffet',
            qty: 1,
            price: 35.9,
            emoji: '',
            item_status: 'done',
          },
          {
            id: 'm1',
            name: 'susi1',
            name_pt: 'susi1',
            qty: 5,
            price: 1.5,
            emoji: '',
            per_person_qty_limit: 2,
            over_limit_unit_price: 4.5,
            added_at: '2026-01-01T00:00:00.000Z',
            item_status: 'pending',
          },
        ],
      },
    ] as Order[];

    assert.equal(sumBillableSessionTotal(orders), 35.9 + 4.5);
  });

  it('keeps catalog row order by created_at even when orders are updated_at-sorted', () => {
    const orders = [
      {
        id: 'o-new',
        status: 'pending',
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-03T00:00:00.000Z',
        items: [
          { id: 'd2', name: 'Cola', name_pt: 'Cola', qty: 1, price: 2, emoji: '🥤' },
        ],
      },
      {
        id: 'o-old',
        status: 'pending',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        items: [
          { id: 'd1', name: 'Água', name_pt: 'Água', qty: 1, price: 1.5, emoji: '💧' },
        ],
      },
    ] as Order[];

    const lines = buildBillableSessionItems(orders);
    assert.deepEqual(
      lines.map((row) => row.item.id),
      ['d1', 'd2'],
    );
    assert.deepEqual(
      buildBillableSessionItems(sortOrdersForBillableCatalog(orders)).map((row) => row.item.id),
      ['d1', 'd2'],
    );
  });

  it('keeps catalog row order when decrement voids the earliest physical line', () => {
    const ordersBefore = [
      {
        id: 'o1',
        status: 'pending',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        items: [
          {
            id: 'd1',
            name: 'Cola',
            name_pt: 'Cola',
            qty: 1,
            price: 2,
            emoji: '🥤',
            added_at: '2026-01-01T00:00:01.000Z',
            item_status: 'pending',
          },
          {
            id: 'd2',
            name: 'Água',
            name_pt: 'Água',
            qty: 1,
            price: 1.5,
            emoji: '💧',
            added_at: '2026-01-01T00:00:02.000Z',
            item_status: 'pending',
          },
          {
            id: 'd1',
            name: 'Cola',
            name_pt: 'Cola',
            qty: 4,
            price: 2,
            emoji: '🥤',
            added_at: '2026-01-01T00:00:03.000Z',
            item_status: 'pending',
          },
        ],
      },
    ] as Order[];

    const before = buildBillableSessionItems(ordersBefore).map((row) => row.item.id);
    assert.deepEqual(before, ['d1', 'd2']);

    const ordersAfter = [
      {
        ...ordersBefore[0],
        updated_at: '2026-01-03T00:00:00.000Z',
        items: [
          {
            ...ordersBefore[0].items[0],
            item_status: 'voided',
            voided_at: '2026-01-03T00:00:00.000Z',
          },
          ordersBefore[0].items[1],
          {
            ...ordersBefore[0].items[2],
            qty: 3,
          },
        ],
      },
    ] as Order[];

    const after = buildBillableSessionItems(ordersAfter).map((row) => row.item.id);
    assert.deepEqual(after, before);
    assert.equal(buildBillableSessionItems(ordersAfter)[0]?.item.qty, 3);
  });
});
