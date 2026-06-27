import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyOrderItemDecrement, canDecrementOrderItem } from '@/lib/order-item-void/decrement-order-item';
import { VOID_ITEM_QTY_ADJUSTMENT_REASON } from '@/lib/audit/reasons';
import type { OrderItem } from '@/types';

const baseItem = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  id: 'item-1',
  name: 'Cola',
  name_pt: 'Cola',
  qty: 3,
  price: 2.5,
  emoji: '🥤',
  item_status: 'pending',
  ...overrides,
});

describe('canDecrementOrderItem', () => {
  it('allows pending and cooking menu lines', () => {
    assert.equal(canDecrementOrderItem(baseItem(), 'pending'), true);
    assert.equal(canDecrementOrderItem(baseItem({ item_status: 'cooking' }), 'cooking'), true);
  });

  it('rejects buffet, done, and voided lines', () => {
    assert.equal(canDecrementOrderItem(baseItem({ kind: 'buffet_base' }), 'pending'), false);
    assert.equal(canDecrementOrderItem(baseItem({ item_status: 'done' }), 'done'), false);
    assert.equal(canDecrementOrderItem(baseItem({ item_status: 'voided' }), 'pending'), false);
  });
});

describe('applyOrderItemDecrement', () => {
  it('decrements qty when greater than one', () => {
    const items = [baseItem()];
    const result = applyOrderItemDecrement(items, 0, 'pending');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.outcome, 'decremented');
    assert.equal(result.nextItems[0]?.qty, 2);
    assert.equal(result.nextItems[0]?.item_status, 'pending');
  });

  it('voids the line when qty is one', () => {
    const items = [baseItem({ qty: 1 })];
    const result = applyOrderItemDecrement(items, 0, 'pending');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.outcome, 'voided');
    assert.equal(result.nextItems[0]?.item_status, 'voided');
    assert.equal(result.nextItems[0]?.void_reason, VOID_ITEM_QTY_ADJUSTMENT_REASON);
    assert.ok(result.nextItems[0]?.voided_at);
  });

  it('rejects invalid indexes and buffet lines', () => {
    assert.deepEqual(applyOrderItemDecrement([baseItem()], -1, 'pending'), {
      ok: false,
      code: 'invalid_index',
    });
    assert.deepEqual(
      applyOrderItemDecrement([baseItem({ kind: 'buffet_base' })], 0, 'pending'),
      { ok: false, code: 'buffet_line' },
    );
  });
});
