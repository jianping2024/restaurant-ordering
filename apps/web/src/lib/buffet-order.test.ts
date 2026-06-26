import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBuffetBaseLine,
  formatBuffetGuestCountsOptional,
  isBuffetGuestCountsUnchanged,
} from '@/lib/buffet-order';
import type { Order } from '@/types';

const labels = { adults: '{n}大人', children: '{n}小孩' };
const buffetA = { id: 'buffet-a', name: 'Lunch Buffet' };
const resolved = {
  adult_price: 20,
  child_price: 10,
  rule_id: 'rule-1',
  time_slot_id: 'slot-1',
};

function orderWithBuffet(adults: number, children: number): Order {
  const line = buildBuffetBaseLine({
    buffet: buffetA,
    adultCount: adults,
    childCount: children,
    resolved,
  });
  assert.ok(line);
  return {
    id: 'o1',
    restaurant_id: 'r1',
    session_id: 's1',
    table_id: 't1',
    display_name: 'A1',
    status: 'done',
    items: [line],
    total_amount: line.price,
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-01T10:00:00.000Z',
  };
}

describe('isBuffetGuestCountsUnchanged', () => {
  it('is false when table has no active buffet', () => {
    assert.equal(isBuffetGuestCountsUnchanged([], buffetA.id, 2, 0), false);
  });

  it('is true when buffet type and adult/child counts match', () => {
    const orders = [orderWithBuffet(2, 1)];
    assert.equal(isBuffetGuestCountsUnchanged(orders, buffetA.id, 2, 1), true);
  });

  it('is false when adult count differs', () => {
    const orders = [orderWithBuffet(2, 1)];
    assert.equal(isBuffetGuestCountsUnchanged(orders, buffetA.id, 3, 1), false);
  });

  it('is false when child count differs', () => {
    const orders = [orderWithBuffet(2, 1)];
    assert.equal(isBuffetGuestCountsUnchanged(orders, buffetA.id, 2, 0), false);
  });

  it('is false when total matches but adult/child split differs', () => {
    const orders = [orderWithBuffet(2, 1)];
    assert.equal(isBuffetGuestCountsUnchanged(orders, buffetA.id, 3, 0), false);
  });
});

describe('formatBuffetGuestCountsOptional', () => {
  it('shows both segments when counts are positive', () => {
    assert.equal(formatBuffetGuestCountsOptional(2, 1, labels), '2大人 · 1小孩');
  });

  it('omits zero adult segment', () => {
    assert.equal(formatBuffetGuestCountsOptional(0, 3, labels), '3小孩');
  });

  it('omits zero child segment', () => {
    assert.equal(formatBuffetGuestCountsOptional(4, 0, labels), '4大人');
  });

  it('returns empty when both are zero', () => {
    assert.equal(formatBuffetGuestCountsOptional(0, 0, labels), '');
  });
});
