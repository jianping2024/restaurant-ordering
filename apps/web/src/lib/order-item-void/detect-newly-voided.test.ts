import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectNewlyVoidedItems } from '@/lib/order-item-void/detect-newly-voided';
import type { OrderItem } from '@/types';

const baseItem = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  id: 'item-1',
  name: 'Soup',
  name_pt: 'Soup',
  qty: 1,
  price: 10,
  emoji: '🍲',
  ...overrides,
});

describe('detectNewlyVoidedItems', () => {
  it('returns empty when no items became voided', () => {
    const before = [baseItem({ item_status: 'pending' }), baseItem({ id: 'item-2', item_status: 'cooking' })];
    const after = [
      baseItem({ item_status: 'cooking' }),
      baseItem({ id: 'item-2', item_status: 'cooking' }),
    ];
    assert.deepEqual(detectNewlyVoidedItems(before, after), []);
  });

  it('detects a single newly voided line', () => {
    const before = [baseItem({ item_status: 'cooking' })];
    const after = [
      baseItem({ item_status: 'voided', voided_at: '2026-01-01T00:00:00.000Z' }),
    ];
    const rows = detectNewlyVoidedItems(before, after);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.itemIndex, 0);
    assert.equal(rows[0]?.statusBefore, 'cooking');
  });
});
