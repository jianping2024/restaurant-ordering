import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeBillSplitsFromRefresh } from './checkout-request-state';
import type { BillSplit } from '@/types';

const baseSplit = (id: string, overrides: Partial<BillSplit> = {}): BillSplit =>
  ({
    id,
    restaurant_id: 'r1',
    order_ids: [],
    split_mode: 'even',
    persons: [],
    result: [{ name: 'A', amount: 10, paid: false }],
    total_amount: 10,
    status: 'requested',
    created_at: '2026-01-01T00:00:00Z',
    session_id: 's1',
    table_id: 't1',
    display_name: '1',
    discount_rate: 0,
    ...overrides,
  }) as BillSplit;

test('mergeBillSplitsFromRefresh preserves paid flags from local state', () => {
  const prev = [baseSplit('a', { result: [{ name: 'A', amount: 10, paid: true }] })];
  const incoming = [baseSplit('a', { result: [{ name: 'A', amount: 10, paid: false }] })];
  const merged = mergeBillSplitsFromRefresh(prev, incoming);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.result?.[0]?.paid, true);
});

test('mergeBillSplitsFromRefresh replaces queue with server list', () => {
  const prev = [baseSplit('a'), baseSplit('b')];
  const incoming = [baseSplit('c')];
  const merged = mergeBillSplitsFromRefresh(prev, incoming);
  assert.deepEqual(
    merged.map((row) => row.id),
    ['c'],
  );
});
