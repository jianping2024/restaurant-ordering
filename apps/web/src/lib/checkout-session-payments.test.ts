import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit } from '@/types';
import {
  collectibleSplitRowsWithIndex,
  isSplitRowCollectible,
  parseSessionCollectedPayments,
  reconcileSplitResultPaid,
  suggestedCollectionAmount,
  sumCollectedByPersonIndex,
  totalCollectedAmount,
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

describe('parseSessionCollectedPayments', () => {
  it('maps person_index', () => {
    const rows = parseSessionCollectedPayments([
      {
        id: 'pay-1',
        person_index: 1,
        person_name: 'John',
        amount: 26.4,
        created_at: '2026-06-27T14:30:00.000Z',
      },
    ]);
    assert.equal(rows[0]?.person_index, 1);
  });
});

describe('sumCollectedByPersonIndex', () => {
  it('aggregates by index', () => {
    const map = sumCollectedByPersonIndex([
      { id: '1', person_index: 0, person_name: 'A', amount: 10, created_at: '' },
      { id: '2', person_index: 0, person_name: 'A', amount: 5, created_at: '' },
      { id: '3', person_index: 1, person_name: 'B', amount: 20, created_at: '' },
    ]);
    assert.equal(map.get(0), 15);
    assert.equal(map.get(1), 20);
  });

  it('ignores rows without index', () => {
    const map = sumCollectedByPersonIndex([
      { id: '1', person_index: null, person_name: 'Legacy', amount: 10, created_at: '' },
    ]);
    assert.equal(map.size, 0);
  });
});

describe('suggestedCollectionAmount', () => {
  it('subtracts prior collections for index', () => {
    const map = sumCollectedByPersonIndex([
      { id: '1', person_index: 0, person_name: 'John', amount: 24.45, created_at: '' },
    ]);
    assert.equal(suggestedCollectionAmount(0, 30, map), 5.55);
  });
});

describe('isSplitRowCollectible', () => {
  it('uses index not name', () => {
    const map = sumCollectedByPersonIndex([
      { id: '1', person_index: 1, person_name: '张三', amount: 20, created_at: '' },
    ]);
    assert.equal(isSplitRowCollectible(30, map, 0), true);
    assert.equal(isSplitRowCollectible(30, map, 1), true);
    assert.equal(isSplitRowCollectible(20, map, 1), false);
  });

  it('two same names different indices stay independent', () => {
    const map = sumCollectedByPersonIndex([
      { id: '1', person_index: 0, person_name: '张三', amount: 30, created_at: '' },
    ]);
    assert.equal(isSplitRowCollectible(30, map, 0), false);
    assert.equal(isSplitRowCollectible(25, map, 1), true);
  });
});

describe('collectibleSplitRowsWithIndex', () => {
  it('includes only indices with balance', () => {
    const map = sumCollectedByPersonIndex([
      { id: '1', person_index: 0, person_name: 'John', amount: 30, created_at: '' },
    ]);
    const pending = collectibleSplitRowsWithIndex(
      [
        { name: 'John', amount: 30, paid: true },
        { name: 'Mary', amount: 20 },
      ],
      map,
    );
    assert.deepEqual(
      pending.map((entry) => entry.index),
      [1],
    );
  });

  it('excludes paid rows even when ledger is stale', () => {
    const pending = collectibleSplitRowsWithIndex(
      [
        { name: 'John', amount: 30, paid: true },
        { name: 'Mary', amount: 20 },
      ],
      new Map(),
    );
    assert.deepEqual(
      pending.map((entry) => entry.index),
      [1],
    );
  });
});

describe('reconcileSplitResultPaid', () => {
  it('marks paid when index ledger covers obligation', () => {
    const map = sumCollectedByPersonIndex([
      { id: '1', person_index: 0, person_name: 'Ana', amount: 20, created_at: '' },
    ]);
    const rows = reconcileSplitResultPaid(
      [
        { name: 'Ana', amount: 30, paid: true },
        { name: 'Bob', amount: 25 },
      ],
      map,
    );
    assert.equal(rows[0]?.paid, false);
    assert.equal(rows[1]?.paid, false);
  });
});

describe('totalCollectedAmount', () => {
  it('sums all ledger rows', () => {
    assert.equal(
      totalCollectedAmount([
        { id: '1', person_index: 0, person_name: 'A', amount: 10, created_at: '' },
        { id: '2', person_index: 1, person_name: 'B', amount: 5.5, created_at: '' },
      ]),
      15.5,
    );
  });
});

describe('billSplit placeholder', () => {
  it('keeps test helper referenced', () => {
    assert.equal(billSplit().display_name, 'A-01');
  });
});
