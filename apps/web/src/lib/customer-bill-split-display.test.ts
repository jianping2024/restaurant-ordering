import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  billSplitDisplayResults,
  buildCustomerSplitDisplayRows,
  customerBillCallAmount,
  deriveCustomerSplitSettlementStatus,
  initialPersistedSplitResult,
  splitRowDisplayAmount,
  sumSplitDisplayOutstanding,
} from './customer-bill-split-display';

describe('billSplitDisplayResults', () => {
  const draft = [
    { name: 'Ana', amount: 126.35 },
    { name: 'Tom', amount: 124.5 },
  ];
  const persisted = [
    { name: 'Ana', amount: 25.45, paid: true },
    { name: 'Tom', amount: 71.9 },
  ];

  it('uses draft while checkout is editable', () => {
    assert.deepEqual(
      billSplitDisplayResults({
        checkoutSubmitted: false,
        persistedResult: persisted,
        draftResults: draft,
      }),
      draft,
    );
  });

  it('uses persisted snapshot on submitted success screen', () => {
    assert.deepEqual(
      billSplitDisplayResults({
        checkoutSubmitted: true,
        persistedResult: persisted,
        draftResults: draft,
      }),
      persisted,
    );
  });

  it('falls back to draft when submitted but persisted is empty', () => {
    assert.deepEqual(
      billSplitDisplayResults({
        checkoutSubmitted: true,
        persistedResult: null,
        draftResults: draft,
      }),
      draft,
    );
  });
});

describe('initialPersistedSplitResult', () => {
  it('returns null during continuation editing', () => {
    assert.equal(
      initialPersistedSplitResult(
        [{ name: 'Ana', amount: 25.45, paid: true }],
        false,
      ),
      null,
    );
  });

  it('hydrates snapshot for submitted success screen', () => {
    const rows = [{ name: 'Ana', amount: 25.45, paid: true }];
    assert.deepEqual(initialPersistedSplitResult(rows, true), rows);
  });
});

describe('deriveCustomerSplitSettlementStatus', () => {
  it('returns partial when ledger covers part of obligation', () => {
    assert.equal(deriveCustomerSplitSettlementStatus(27.45, 19.95), 'partial');
  });

  it('returns settled when ledger covers obligation', () => {
    assert.equal(deriveCustomerSplitSettlementStatus(27.45, 27.45), 'settled');
  });

  it('returns due when nothing collected', () => {
    assert.equal(deriveCustomerSplitSettlementStatus(27.45, 0), 'due');
  });
});

describe('buildCustomerSplitDisplayRows', () => {
  it('shows partial continuation balance despite stale paid flag', () => {
    const rows = buildCustomerSplitDisplayRows(
      [
        { name: 'Ana', amount: 27.45, paid: true },
        { name: 'Tom', amount: 71.9 },
      ],
      [{ id: '1', person_index: 0, person_name: 'Ana', amount: 19.95, created_at: '' }],
    );
    assert.deepEqual(rows[0], {
      name: 'Ana',
      obligationAmount: 27.45,
      collectedAmount: 19.95,
      outstandingAmount: 7.5,
      settlementStatus: 'partial',
    });
    assert.equal(rows[1]?.settlementStatus, 'due');
  });

  it('marks settled only when ledger covers obligation', () => {
    const rows = buildCustomerSplitDisplayRows(
      [{ name: 'Ana', amount: 31.7, paid: false }],
      [{ id: '1', person_index: 0, person_name: 'Ana', amount: 31.7, created_at: '' }],
    );
    assert.equal(rows[0]?.settlementStatus, 'settled');
  });
});

describe('splitRowDisplayAmount', () => {
  it('shows outstanding for partial rows', () => {
    const row = buildCustomerSplitDisplayRows(
      [{ name: 'Ana', amount: 27.45 }],
      [{ id: '1', person_index: 0, person_name: 'Ana', amount: 19.95, created_at: '' }],
    )[0]!;
    assert.equal(splitRowDisplayAmount(row), 7.5);
  });
});

describe('customerBillCallAmount', () => {
  const splitRows = [
    { name: '客人 1', amount: 659.7 },
    { name: '客人 2', amount: 659.7 },
  ];
  const collected = [
    { id: '1', person_index: 0, person_name: '客人 1', amount: 659.7, created_at: '' },
  ];

  it('returns full total when no collections', () => {
    assert.equal(
      customerBillCallAmount({
        total: 1319.4,
        splitMode: 'even',
        resultRows: splitRows,
        collectedPayments: [],
      }),
      1319.4,
    );
  });

  it('returns pending split balance after partial collection', () => {
    assert.equal(
      customerBillCallAmount({
        total: 1319.4,
        splitMode: 'even',
        resultRows: splitRows,
        collectedPayments: collected,
      }),
      659.7,
    );
  });

  it('sums outstanding across partial and due rows', () => {
    const rows = buildCustomerSplitDisplayRows(
      [
        { name: 'Ana', amount: 27.45 },
        { name: 'Tom', amount: 71.9 },
      ],
      [
        { id: '1', person_index: 0, person_name: 'Ana', amount: 19.95, created_at: '' },
      ],
    );
    assert.equal(sumSplitDisplayOutstanding(rows), 7.5 + 71.9);
    assert.equal(
      customerBillCallAmount({
        total: 99.35,
        splitMode: 'even',
        resultRows: [
          { name: 'Ana', amount: 27.45 },
          { name: 'Tom', amount: 71.9 },
        ],
        collectedPayments: [
          { id: '1', person_index: 0, person_name: 'Ana', amount: 19.95, created_at: '' },
        ],
      }),
      79.4,
    );
  });
});
