import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit } from '@/types';
import {
  collectibleSplitRowsWithIndex,
  collectedPersonNames,
  parseSessionCollectedPayments,
  isSplitRowCollectible,
  reconcileSplitResultPaid,
  resumeCheckoutBlockReason,
  resumeOrderingConfirmVariant,
  suggestedCollectionAmount,
  sumCollectedByPersonName,
  totalCollectedAmount,
  uniqueCollectedPersonNames,
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
  it('maps ledger rows with numeric amount', () => {
    const rows = parseSessionCollectedPayments([
      {
        id: 'pay-1',
        person_name: 'John',
        amount: 26.4,
        created_at: '2026-06-27T14:30:00.000Z',
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.person_name, 'John');
    assert.equal(rows[0]?.amount, 26.4);
    assert.equal(rows[0]?.created_at, '2026-06-27T14:30:00.000Z');
  });
});

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

describe('isSplitRowCollectible', () => {
  it('ignores stale paid flag when ledger still owes', () => {
    const map = sumCollectedByPersonName([
      { id: '1', person_name: 'Ana', amount: 19.95, created_at: '' },
    ]);
    assert.equal(
      isSplitRowCollectible({ name: 'Ana', amount: 27.45, paid: true }, map),
      true,
    );
  });

  it('returns false when ledger covers obligation', () => {
    const map = sumCollectedByPersonName([
      { id: '1', person_name: 'Ana', amount: 27.45, created_at: '' },
    ]);
    assert.equal(
      isSplitRowCollectible({ name: 'Ana', amount: 27.45, paid: false }, map),
      false,
    );
  });
});

describe('collectibleSplitRowsWithIndex', () => {
  it('includes paid rows that still owe after continuation', () => {
    const map = sumCollectedByPersonName([
      { id: '1', person_name: 'Ana', amount: 20, created_at: '' },
    ]);
    const pending = collectibleSplitRowsWithIndex(
      [
        { name: 'Ana', amount: 30, paid: true },
        { name: 'Bob', amount: 25 },
      ],
      map,
    );
    assert.deepEqual(
      pending.map((entry) => ({ name: entry.row.name, index: entry.index, amount: entry.row.amount })),
      [
        { name: 'Ana', index: 0, amount: 30 },
        { name: 'Bob', index: 1, amount: 25 },
      ],
    );
  });

  it('drops rows with zero outstanding balance', () => {
    const map = sumCollectedByPersonName([
      { id: '1', person_name: 'John', amount: 30, created_at: '' },
    ]);
    const pending = collectibleSplitRowsWithIndex(
      [{ name: 'John', amount: 30, paid: true }, { name: 'Mary', amount: 20 }],
      map,
    );
    assert.deepEqual(
      pending.map((entry) => ({ name: entry.row.name, index: entry.index })),
      [{ name: 'Mary', index: 1 }],
    );
  });
});

describe('reconcileSplitResultPaid', () => {
  it('marks paid only when ledger covers obligation', () => {
    const map = sumCollectedByPersonName([
      { id: '1', person_name: 'Ana', amount: 20, created_at: '' },
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

describe('collectedPersonNames', () => {
  it('normalizes ledger names', () => {
    const names = collectedPersonNames([
      { id: '1', person_name: ' Ana ', amount: 10, created_at: '' },
    ]);
    assert.equal(names.has('ana'), true);
  });
});

describe('uniqueCollectedPersonNames', () => {
  it('dedupes case-insensitively', () => {
    assert.deepEqual(
      uniqueCollectedPersonNames([
        { person_name: 'Ana' },
        { person_name: ' ana ' },
        { person_name: 'Bob' },
      ]),
      ['Ana', 'Bob'],
    );
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

describe('resumeOrderingConfirmVariant', () => {
  it('preserves by-item split regardless of collections', () => {
    assert.equal(
      resumeOrderingConfirmVariant(billSplit({ split_mode: 'by_item' }), []),
      'preserve_by_item',
    );
    assert.equal(
      resumeOrderingConfirmVariant(
        billSplit({
          split_mode: 'by_item',
          result: [{ name: 'John', amount: 10, paid: true }],
        }),
        [{ id: '1', person_name: 'John', amount: 10, created_at: '' }],
      ),
      'preserve_by_item',
    );
  });

  it('branches even/custom by collection state', () => {
    assert.equal(
      resumeOrderingConfirmVariant(billSplit({ split_mode: 'even' }), []),
      'cancel_no_collections',
    );
    assert.equal(
      resumeOrderingConfirmVariant(
        billSplit({
          split_mode: 'even',
          result: [{ name: 'John', amount: 10, paid: true }],
        }),
        [],
      ),
      'preserve_with_collections',
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
