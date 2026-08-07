import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deriveOrderStatusFromItems,
  effectiveItemStatus,
  normalizeOrderItemStatus,
} from '@/lib/order-status';
import type { OrderItem } from '@/types';

const baseItem = (overrides: Partial<OrderItem> = {}): OrderItem => ({
  id: 'm1',
  name: 'Soup',
  name_pt: 'Sopa',
  qty: 1,
  price: 3,
  emoji: '🥣',
  ...overrides,
});

describe('effectiveItemStatus', () => {
  it('returns stored non-cooking statuses unchanged', () => {
    assert.equal(
      effectiveItemStatus({
        item: baseItem({ item_status: 'pending' }),
        orderStatus: 'pending',
        nowMs: Date.now(),
        readyAfterMinutes: 15,
      }),
      'pending',
    );
    assert.equal(
      effectiveItemStatus({
        item: baseItem({ item_status: 'ready' }),
        orderStatus: 'cooking',
        nowMs: Date.now(),
        readyAfterMinutes: 15,
      }),
      'ready',
    );
    assert.equal(
      effectiveItemStatus({
        item: baseItem({ item_status: 'done' }),
        orderStatus: 'done',
        nowMs: Date.now(),
        readyAfterMinutes: 15,
      }),
      'done',
    );
  });

  it('keeps cooking before the ready threshold', () => {
    const started = '2026-08-07T12:00:00.000Z';
    const nowMs = Date.parse('2026-08-07T12:10:00.000Z');
    assert.equal(
      effectiveItemStatus({
        item: baseItem({ item_status: 'cooking', started_at: started }),
        orderStatus: 'cooking',
        nowMs,
        readyAfterMinutes: 15,
      }),
      'cooking',
    );
  });

  it('treats cooking as ready after started_at + N minutes (display only)', () => {
    const started = '2026-08-07T12:00:00.000Z';
    const nowMs = Date.parse('2026-08-07T12:15:00.000Z');
    assert.equal(
      effectiveItemStatus({
        item: baseItem({ item_status: 'cooking', started_at: started }),
        orderStatus: 'cooking',
        nowMs,
        readyAfterMinutes: 15,
      }),
      'ready',
    );
  });

  it('stays cooking when started_at is missing', () => {
    assert.equal(
      effectiveItemStatus({
        item: baseItem({ item_status: 'cooking' }),
        orderStatus: 'cooking',
        nowMs: Date.now(),
        readyAfterMinutes: 15,
      }),
      'cooking',
    );
  });
});

describe('deriveOrderStatusFromItems with ready', () => {
  it('treats stored ready as in-progress cooking at order level', () => {
    assert.equal(
      deriveOrderStatusFromItems([baseItem({ item_status: 'ready' })]),
      'cooking',
    );
  });

  it('normalizes unknown status from order fallback', () => {
    assert.equal(normalizeOrderItemStatus(baseItem({}), 'cooking'), 'cooking');
  });
});
