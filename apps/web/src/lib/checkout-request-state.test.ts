import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkoutPersonKey,
  checkoutResumeOrderingKey,
  isCheckoutDetailLocked,
  mergeBillSplitsFromRefresh,
} from './checkout-request-state';
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

test('mergeBillSplitsFromRefresh drops unpaid by-item tickets removed on server', () => {
  const prev = [
    baseSplit('a', {
      split_mode: 'by_item',
      result: [
        { name: 'Aa', amount: 17.9, paid: false, party_id: 'p-aa' },
        { name: 'Kk4', amount: 17.9, paid: false, party_id: 'p-kk' },
      ],
    }),
  ];
  const incoming = [
    baseSplit('a', {
      split_mode: 'by_item',
      result: [{ name: 'Aa', amount: 17.9, paid: false, party_id: 'p-aa' }],
    }),
  ];
  const merged = mergeBillSplitsFromRefresh(prev, incoming);
  assert.deepEqual(
    (merged[0]?.result ?? []).map((row) => row.name),
    ['Aa'],
  );
});

test('mergeBillSplitsFromRefresh does not pad shorter even result with dropped people', () => {
  const prev = [
    baseSplit('a', {
      result: [
        { name: 'A', amount: 10, paid: false },
        { name: 'B', amount: 10, paid: false },
      ],
    }),
  ];
  const incoming = [
    baseSplit('a', {
      result: [{ name: 'A', amount: 20, paid: false }],
    }),
  ];
  const merged = mergeBillSplitsFromRefresh(prev, incoming);
  assert.deepEqual(
    (merged[0]?.result ?? []).map((row) => row.name),
    ['A'],
  );
});

test('isCheckoutDetailLocked is true for payment and resume operations', () => {
  const billSplitId = 'split-1';
  assert.equal(
    isCheckoutDetailLocked(new Set([checkoutPersonKey(billSplitId, 0)]), billSplitId),
    true,
  );
  assert.equal(
    isCheckoutDetailLocked(new Set([checkoutResumeOrderingKey(billSplitId)]), billSplitId),
    true,
  );
  assert.equal(isCheckoutDetailLocked(new Set(['other:resume']), billSplitId), false);
});
