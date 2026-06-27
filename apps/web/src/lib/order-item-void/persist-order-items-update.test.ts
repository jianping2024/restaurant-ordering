import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeOrderTotalsFromItems } from '@/lib/order-item-void/persist-order-items-update';
import type { OrderItem } from '@/types';

const item = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  id: 'item-1',
  name: 'Soup',
  name_pt: 'Soup',
  qty: 2,
  price: 5,
  emoji: '🍲',
  item_status: 'pending',
  ...overrides,
});

describe('computeOrderTotalsFromItems', () => {
  it('sums only non-voided lines', () => {
    const totals = computeOrderTotalsFromItems(
      [item(), item({ id: 'item-2', qty: 1, price: 3, item_status: 'voided' })],
      'pending',
    );
    assert.equal(totals.total_amount, 10);
    assert.equal(totals.nextStatus, 'pending');
  });

  it('derives cooking status from active kitchen lines', () => {
    const totals = computeOrderTotalsFromItems([item({ item_status: 'cooking' })], 'pending');
    assert.equal(totals.nextStatus, 'cooking');
  });
});
