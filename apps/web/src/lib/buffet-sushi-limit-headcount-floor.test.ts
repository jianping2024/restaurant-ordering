import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { totalGuestsInBuffetSnapshot } from '@/lib/buffet-order';
import { findBuffetHeadcountBelowSushiLimitFloor } from '@/lib/buffet-sushi-limit-headcount-floor';
import {
  collectSessionMenuItemIds,
  isSushiOveragePricedLine,
  minGuestsForIncludedLimitedQty,
  sessionIncludedQtyForLimitedMenuItem,
  sushiFreeAllowanceHeadcountFloor,
} from '@/lib/sushi-buffet-limits';
import type { Order } from '@/types';

function orderWithItems(items: Order['items']): Pick<Order, 'items' | 'status'> {
  return { status: 'pending', items };
}

describe('sushi free-allowance headcount floor', () => {
  it('counts included qty and ignores overage-priced lines', () => {
    const orders = [
      orderWithItems([
        {
          id: 'm1',
          name: 'susi',
          name_pt: 'susi',
          qty: 2,
          price: 0,
          emoji: '',
        },
        {
          id: 'm1',
          name: 'susi',
          name_pt: 'susi',
          qty: 2,
          price: 4.5,
          emoji: '',
        },
      ]),
    ];
    assert.equal(
      sessionIncludedQtyForLimitedMenuItem(orders, 'm1', {
        price: 0,
        over_limit_unit_price: 4.5,
      }),
      2,
    );
    assert.equal(isSushiOveragePricedLine(4.5, 0, 4.5), true);
    assert.equal(isSushiOveragePricedLine(0, 0, 4.5), false);
  });

  it('ceil-divides included qty by per-person limit', () => {
    assert.equal(minGuestsForIncludedLimitedQty(2, 4), 2);
    assert.equal(minGuestsForIncludedLimitedQty(2, 5), 3);
    assert.equal(minGuestsForIncludedLimitedQty(2, 0), 0);
  });

  it('floor uses included qty only (staff overage does not inflate)', () => {
    const orders = [
      orderWithItems([
        { id: 'm1', name: 'a', name_pt: 'a', qty: 2, price: 0, emoji: '' },
        { id: 'm1', name: 'a', name_pt: 'a', qty: 3, price: 4.5, emoji: '' },
      ]),
    ];
    assert.equal(
      sushiFreeAllowanceHeadcountFloor({
        serviceMode: 'sushi',
        sessionOrders: orders,
        catalog: [
          {
            id: 'm1',
            price: 0,
            per_person_qty_limit: 2,
            over_limit_unit_price: 4.5,
          },
        ],
      }),
      1,
    );
  });

  it('floor takes max across limited dishes; classic is zero', () => {
    const orders = [
      orderWithItems([
        { id: 'a', name: 'a', name_pt: 'a', qty: 4, price: 0, emoji: '' },
        { id: 'b', name: 'b', name_pt: 'b', qty: 3, price: 0, emoji: '' },
      ]),
    ];
    assert.equal(
      sushiFreeAllowanceHeadcountFloor({
        serviceMode: 'sushi',
        sessionOrders: orders,
        catalog: [
          {
            id: 'a',
            price: 0,
            per_person_qty_limit: 2,
            over_limit_unit_price: 4,
          },
          {
            id: 'b',
            price: 0,
            per_person_qty_limit: 1,
            over_limit_unit_price: 3,
          },
        ],
      }),
      3,
    );
    assert.equal(
      sushiFreeAllowanceHeadcountFloor({
        serviceMode: 'classic',
        sessionOrders: orders,
        catalog: [
          {
            id: 'a',
            price: 0,
            per_person_qty_limit: 2,
            over_limit_unit_price: 4,
          },
        ],
      }),
      0,
    );
  });

  it('snapshot guest total and floor violation', () => {
    assert.equal(
      totalGuestsInBuffetSnapshot({
        b1: { adults: 2, children: 1 },
        b2: { adults: 1, children: 0 },
      }),
      4,
    );
    assert.equal(
      findBuffetHeadcountBelowSushiLimitFloor({ b1: { adults: 2, children: 0 } }, 2),
      null,
    );
    const violation = findBuffetHeadcountBelowSushiLimitFloor(
      { b1: { adults: 1, children: 0 } },
      2,
    );
    assert.deepEqual(violation, { minGuests: 2, proposedGuests: 1 });
  });

  it('collects non-voided menu ids', () => {
    const ids = collectSessionMenuItemIds([
      orderWithItems([
        { id: 'm1', name: 'a', name_pt: 'a', qty: 1, price: 0, emoji: '' },
        {
          id: 'buffet:x',
          name: 'b',
          name_pt: 'b',
          qty: 1,
          price: 10,
          emoji: '',
          kind: 'buffet_base',
        },
        {
          id: 'm2',
          name: 'c',
          name_pt: 'c',
          qty: 1,
          price: 0,
          emoji: '',
          item_status: 'voided',
        },
      ]),
    ]);
    assert.deepEqual(ids, ['m1']);
  });
});
