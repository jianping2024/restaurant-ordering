import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  httpStatusForSushiSettlementError,
  rebalanceOrdersForSushiSettlement,
} from '@/lib/sushi-settlement-rebalance';
import type { Order, OrderItem } from '@/types';

function item(partial: Partial<OrderItem> & Pick<OrderItem, 'id' | 'qty' | 'price'>): OrderItem {
  return {
    name: 'susi',
    name_pt: 'susi',
    emoji: '',
    ...partial,
  };
}

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

const catalog = [
  {
    id: 'm1',
    price: 0,
    per_person_qty_limit: 2,
    over_limit_unit_price: 4.5,
  },
];

describe('rebalanceOrdersForSushiSettlement', () => {
  it('is a no-op in classic mode', () => {
    const orders = [order([item({ id: 'm1', qty: 4, price: 0 })])];
    const result = rebalanceOrdersForSushiSettlement({
      serviceMode: 'classic',
      orders,
      catalog,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.orders, orders);
  });

  it('splits a single menu-price line into free + overage at settlement', () => {
    const orders = [
      order([
        item({
          id: 'buffet:x',
          qty: 1,
          price: 20,
          kind: 'buffet_base',
          buffet_id: 'b1',
          adult_count: 1,
          child_count: 0,
          item_status: 'done',
        }),
        item({ id: 'm1', qty: 4, price: 0, item_status: 'pending' }),
      ]),
    ];
    const result = rebalanceOrdersForSushiSettlement({
      serviceMode: 'sushi',
      orders,
      catalog,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const menu = (result.orders[0].items || []).filter((i) => i.id === 'm1');
    assert.deepEqual(
      menu.map((i) => ({ qty: i.qty, price: i.price })),
      [
        { qty: 2, price: 0 },
        { qty: 2, price: 4.5 },
      ],
    );
    assert.equal(result.orders[0].total_amount, 20 + 9);
  });

  it('collapses prior free/overage garbage into settlement slices', () => {
    const orders = [
      order([
        item({
          id: 'buffet:x',
          qty: 1,
          price: 35.9,
          kind: 'buffet_base',
          buffet_id: 'b1',
          adult_count: 2,
          child_count: 0,
          item_status: 'done',
        }),
        item({ id: 'm1', qty: 3, price: 0 }),
        item({ id: 'm1', qty: 1, price: 4.5 }),
      ]),
    ];
    const result = rebalanceOrdersForSushiSettlement({
      serviceMode: 'sushi',
      orders,
      catalog,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const menu = (result.orders[0].items || []).filter((i) => i.id === 'm1');
    assert.deepEqual(
      menu.map((i) => ({ qty: i.qty, price: i.price })),
      [
        { qty: 4, price: 0 },
      ],
    );
  });

  it('requires headcount when limited lines exist', () => {
    const orders = [order([item({ id: 'm1', qty: 1, price: 0 })])];
    const result = rebalanceOrdersForSushiSettlement({
      serviceMode: 'sushi',
      orders,
      catalog,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'limited_item_requires_headcount');
  });
});

describe('httpStatusForSushiSettlementError', () => {
  it('maps client-fixable settlement errors to 400', () => {
    assert.equal(httpStatusForSushiSettlementError('limited_item_requires_headcount'), 400);
    assert.equal(httpStatusForSushiSettlementError('over_limit_price_missing'), 400);
  });

  it('maps infra settlement errors to 500', () => {
    assert.equal(httpStatusForSushiSettlementError('catalog_lookup_failed'), 500);
    assert.equal(httpStatusForSushiSettlementError('persist_failed'), 500);
  });
});
