import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sumActiveOrderItemsTotal } from './waiter-table-card';
import type { Order } from '@/types';

describe('sumActiveOrderItemsTotal', () => {
  it('sums non-voided line totals across orders', () => {
    const orders = [
      {
        id: 'o1',
        status: 'pending',
        items: [
          { price: 10, qty: 2, item_status: 'pending' },
          { price: 5, qty: 1, item_status: 'voided' },
        ],
      },
      {
        id: 'o2',
        status: 'done',
        items: [{ price: 3.5, qty: 2, item_status: 'done' }],
      },
    ] as Order[];

    assert.equal(sumActiveOrderItemsTotal(orders), 27);
  });

  it('returns zero for empty orders', () => {
    assert.equal(sumActiveOrderItemsTotal([]), 0);
  });
});
