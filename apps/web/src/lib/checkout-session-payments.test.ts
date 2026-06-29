import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit } from '@/types';
import {
  resumeCheckoutBlockReason,
  suggestedCollectionAmount,
  sumCollectedByPersonName,
  totalCollectedAmount,
  unpaidSplitRowsWithIndex,
} from './checkout-session-payments';

function billSplit(overrides: Partial<BillSplit> = {}): BillSplit {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    restaurant_id: '11111111-1111-4111-8111-111111111111',
    order_ids: [],
    split_mode: 'even',
    persons: [],
    result: [],
    total_amount: 0,
    status: 'requested',
    created_at: '2026-05-29T00:00:00.000Z',
    session_id: '44444444-4444-4444-8444-444444444444',
    table_id: '33333333-3333-4333-8333-333333333333',
    display_name: 'A-01',
    ...overrides,
  };
}

describe('sumCollectedByPersonName', () => {
  it('aggregates by trimmed person name', () => {
    const map = sumCollectedByPersonName([
      { id: '1', person_name: 'John', amount: 10, created_at: '' },
      { id: '2', person_name: ' John ', amount: 5, created_at: '' },
      { id: '3', person_name: 'Monica', amount: 20, created_at: '' },
    ]);
    assert.equal(map.get('John'), 15);
    assert.equal(map.get('Monica'), 20);
  });
});

describe('suggestedCollectionAmount', () => {
  it('subtracts prior collections from new payable', () => {
    const map = sumCollectedByPersonName([
      { id: '1', person_name: 'John', amount: 24.45, created_at: '' },
    ]);
    assert.equal(suggestedCollectionAmount('John', 30, map), 5.55);
  });

  it('never returns negative', () => {
    const map = sumCollectedByPersonName([
      { id: '1', person_name: 'John', amount: 40, created_at: '' },
    ]);
    assert.equal(suggestedCollectionAmount('John', 30, map), 0);
  });
});

describe('totalCollectedAmount', () => {
  it('sums all ledger rows', () => {
    assert.equal(
      totalCollectedAmount([
        { id: '1', person_name: 'A', amount: 10, created_at: '' },
        { id: '2', person_name: 'B', amount: 5.5, created_at: '' },
      ]),
      15.5,
    );
  });
});

describe('unpaidSplitRowsWithIndex', () => {
  it('drops paid rows and keeps original indices', () => {
    const pending = unpaidSplitRowsWithIndex([
      { name: 'John', amount: 10, paid: true },
      { name: 'Mary', amount: 20 },
      { name: 'Mike', amount: 30, paid: true },
      { name: 'Ann', amount: 40 },
    ]);
    assert.deepEqual(
      pending.map((entry) => ({ name: entry.row.name, index: entry.index })),
      [
        { name: 'Mary', index: 1 },
        { name: 'Ann', index: 3 },
      ],
    );
  });
});

describe('resumeCheckoutBlockReason', () => {
  it('blocks whole table when a row is paid', () => {
    const reason = resumeCheckoutBlockReason(
      billSplit({ result: [{ name: 'Total', amount: 50, paid: true }] }),
      [],
    );
    assert.equal(reason, 'whole_table_paid');
  });

  it('blocks whole table when ledger has entries', () => {
    const reason = resumeCheckoutBlockReason(
      billSplit({ result: [{ name: 'Total', amount: 50 }] }),
      [{ id: '1', person_name: 'Total', amount: 50, created_at: '' }],
    );
    assert.equal(reason, 'whole_table_paid');
  });

  it('allows split mode with partial collections', () => {
    const reason = resumeCheckoutBlockReason(
      billSplit({
        result: [
          { name: 'John', amount: 25, paid: true },
          { name: 'Monica', amount: 25 },
        ],
      }),
      [{ id: '1', person_name: 'John', amount: 25, created_at: '' }],
    );
    assert.equal(reason, null);
  });
});
