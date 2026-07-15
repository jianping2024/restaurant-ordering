import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCustomerSubmittedDisplayOrders } from '@/lib/customer-submitted-order-display';
import { formatCustomerOrderSubmittedTime } from '@/lib/format-dashboard-date';
import type { Order } from '@/types';

const orderWithItems = (
  items: Order['items'],
  id = 'o1',
  createdAt = '2026-07-15T12:30:00.000Z',
): Order => ({
  id,
  restaurant_id: 'r1',
  table_id: 't1',
  session_id: 's1',
  status: 'pending',
  items,
  total_amount: 10,
  created_at: createdAt,
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
        {
          id: 'i1',
          name: 'Soup',
          name_pt: 'Soup',
          qty: 1,
          price: 3,
          emoji: '🥣',
          batch_id: 'batch-a',
          added_at: '2026-07-15T12:30:00.000Z',
        },
        {
          id: 'i2',
          name: 'Void',
          name_pt: 'Void',
          qty: 1,
          price: 1,
          emoji: '🍽',
          item_status: 'voided',
          batch_id: 'batch-a',
          added_at: '2026-07-15T12:30:00.000Z',
        },
      ]),
    ], 'en');

    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.groupKey, 'batch-a');
    assert.equal(groups[0]?.lines.length, 1);
    assert.match(groups[0]?.lines[0]?.label ?? '', /Soup/);
  });

  it('splits append batches and sorts by submitted time', () => {
    const groups = buildCustomerSubmittedDisplayOrders([
      orderWithItems([
        {
          id: 'i1',
          name: 'Later',
          name_pt: 'Later',
          qty: 1,
          price: 3,
          emoji: '🥤',
          batch_id: 'batch-b',
          added_at: '2026-07-15T13:00:00.000Z',
        },
        {
          id: 'i2',
          name: 'Earlier',
          name_pt: 'Earlier',
          qty: 1,
          price: 3,
          emoji: '🍊',
          batch_id: 'batch-a',
          added_at: '2026-07-15T12:30:00.000Z',
        },
      ]),
    ], 'en');

    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.groupKey, 'batch-a');
    assert.match(groups[0]?.lines[0]?.label ?? '', /Earlier/);
    assert.equal(groups[1]?.groupKey, 'batch-b');
    assert.match(groups[1]?.lines[0]?.label ?? '', /Later/);
    assert.notEqual(groups[0]?.submittedTimeLabel, groups[1]?.submittedTimeLabel);
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

  it('isolates legacy batches per order', () => {
    const groups = buildCustomerSubmittedDisplayOrders([
      orderWithItems([
        { id: 'i1', name: 'A', name_pt: 'A', qty: 1, price: 1, emoji: '🍽' },
      ], 'o1', '2026-07-15T12:00:00.000Z'),
      orderWithItems([
        { id: 'i2', name: 'B', name_pt: 'B', qty: 1, price: 1, emoji: '🍽' },
      ], 'o2', '2026-07-15T12:10:00.000Z'),
    ], 'en');

    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.groupKey, 'o1:legacy');
    assert.equal(groups[1]?.groupKey, 'o2:legacy');
  });
});
