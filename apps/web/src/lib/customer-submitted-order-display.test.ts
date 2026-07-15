import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCustomerSubmittedDisplayOrders } from '@/lib/customer-submitted-order-display';
import { formatCustomerOrderSubmittedTime } from '@/lib/format-dashboard-date';
import type { Order } from '@/types';

const orderWithItems = (items: Order['items'], id = 'o1'): Order => ({
  id,
  restaurant_id: 'r1',
  table_id: 't1',
  session_id: 's1',
  status: 'pending',
  items,
  total_amount: 10,
  created_at: '2026-07-15T12:30:00.000Z',
});

describe('formatCustomerOrderSubmittedTime', () => {
  it('uses Europe/Lisbon so server and client match', () => {
    const label = formatCustomerOrderSubmittedTime('en', '2026-07-15T12:30:00.000Z');
    assert.match(label, /13:30|1:30 PM/i);
  });
});

describe('buildCustomerSubmittedDisplayOrders', () => {
  it('groups visible lines and skips voided items', () => {
    const groups = buildCustomerSubmittedDisplayOrders([
      orderWithItems([
        { id: 'i1', name: 'Soup', name_pt: 'Soup', qty: 1, price: 3, emoji: '🥣' },
        { id: 'i2', name: 'Void', name_pt: 'Void', qty: 1, price: 1, emoji: '🍽', item_status: 'voided' },
      ]),
    ], 'en');

    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.lines.length, 1);
    assert.match(groups[0]?.lines[0]?.label ?? '', /Soup/);
  });

  it('drops orders whose lines are all voided', () => {
    const groups = buildCustomerSubmittedDisplayOrders([
      orderWithItems([
        { id: 'i1', name: 'Void', name_pt: 'Void', qty: 1, price: 1, emoji: '🍽', item_status: 'voided' },
      ]),
    ], 'en');
    assert.equal(groups.length, 0);
  });

  it('handles missing items array', () => {
    const groups = buildCustomerSubmittedDisplayOrders([
      { ...orderWithItems([]), items: undefined as unknown as Order['items'] },
    ], 'en');
    assert.equal(groups.length, 0);
  });
});
