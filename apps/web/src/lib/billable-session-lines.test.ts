import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sumBillableSessionTotal } from '@/lib/billable-session-lines';
import { computeOrderTotalsFromItems } from '@/lib/order-item-void/persist-order-items-update';
import type { Order, OrderItem } from '@/types';

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
});
