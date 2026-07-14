import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BILL_SYNC_FRESH_MS,
  buildOptimisticRequestedBillSplit,
  shouldSkipPreSubmitOrderSync,
  upsertCheckoutRequestInQueue,
} from './checkout-request-submit';
import type { BillSplit } from '@/types';

describe('shouldSkipPreSubmitOrderSync', () => {
  const now = 1_700_000_000_000;

  it('skips when last sync is within freshness window', () => {
    assert.equal(shouldSkipPreSubmitOrderSync(now - 5_000, now), true);
    assert.equal(shouldSkipPreSubmitOrderSync(now - BILL_SYNC_FRESH_MS, now), true);
  });

  it('forces sync when never synced or stale', () => {
    assert.equal(shouldSkipPreSubmitOrderSync(null, now), false);
    assert.equal(shouldSkipPreSubmitOrderSync(now - BILL_SYNC_FRESH_MS - 1, now), false);
  });
});

describe('upsertCheckoutRequestInQueue', () => {
  const row = (id: string, createdAt: string): BillSplit =>
    ({
      id,
      created_at: createdAt,
      table_id: 't1',
      display_name: 'A1',
      restaurant_id: 'r1',
      order_ids: [],
      split_mode: 'custom',
      persons: [],
      result: [],
      total_amount: 10,
      status: 'requested',
    }) as BillSplit;

  it('replaces same id and keeps sort order', () => {
    const prev = [row('a', '2026-01-01T10:00:00.000Z'), row('b', '2026-01-01T11:00:00.000Z')];
    const updated = row('a', '2026-01-01T09:00:00.000Z');
    const merged = upsertCheckoutRequestInQueue(prev, updated);
    assert.deepEqual(merged.map((entry) => entry.id), ['a', 'b']);
    assert.equal(merged[0]?.total_amount, 10);
  });
});

describe('buildOptimisticRequestedBillSplit', () => {
  it('builds requested row for checkout queue', () => {
    const built = buildOptimisticRequestedBillSplit({
      restaurantId: 'r1',
      sessionId: 's1',
      tableId: 't1',
      displayName: '桌 5',
      billSplitId: 'bs1',
      splitMode: 'even',
      persons: [{ name: '客人 1' }],
      result: [{ name: '客人 1', amount: 20 }],
      totalAmount: 20,
      customerNif: null,
      orderIds: ['o1'],
    });
    assert.equal(built.id, 'bs1');
    assert.equal(built.status, 'requested');
    assert.equal(built.session_id, 's1');
    assert.equal(built.order_ids[0], 'o1');
  });
});
