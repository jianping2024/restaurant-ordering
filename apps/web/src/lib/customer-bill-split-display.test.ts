import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  billSplitDisplayResults,
  buildCustomerSplitDisplayRows,
  customerBillCallAmount,
  submittedSplitResult,
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

describe('submittedSplitResult', () => {
  it('returns null during continuation editing', () => {
    assert.equal(
      submittedSplitResult(
        [{ name: 'Ana', amount: 25.45, paid: true }],
        false,
      ),
      null,
    );
  });

  it('hydrates snapshot for submitted success screen', () => {
    const rows = [{ name: 'Ana', amount: 25.45, paid: true }];
    assert.deepEqual(submittedSplitResult(rows, true), rows);
  });
});

describe('buildCustomerSplitDisplayRows', () => {
  it('shows partial continuation balance despite stale paid flag', () => {
    const rows = buildCustomerSplitDisplayRows(
      [
        { name: 'Ana', amount: 27.45, paid: true },
        { name: 'Tom', amount: 71.9 },
      ],
      [{ id: '1', person_index: 0, person_name: 'Ana', amount: 19.95, created_at: '', payment_method: null, payment_lines: null }],
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
      [{ id: '1', person_index: 0, person_name: 'Ana', amount: 31.7, created_at: '', payment_method: null, payment_lines: null }],
    );
    assert.equal(rows[0]?.settlementStatus, 'settled');
  });

  it('settles when ledger covers post-discount obligation', () => {
    const rows = buildCustomerSplitDisplayRows(
      [{ name: 'J', amount: 22.45 }],
      [{ id: '1', person_index: 0, person_name: 'J', amount: 20.21, created_at: '', payment_method: null, payment_lines: null }],
      10,
    );
    assert.equal(rows[0]?.obligationAmount, 20.21);
    assert.equal(rows[0]?.settlementStatus, 'settled');
  });

  it('keeps zero-obligation custom row due when ledger is empty', () => {
    const rows = buildCustomerSplitDisplayRows(
      [
        { name: '客人 1', amount: 0 },
        { name: '客人 2', amount: 28.15 },
      ],
      [],
    );
    assert.equal(rows[0]?.settlementStatus, 'due');
    assert.equal(rows[1]?.settlementStatus, 'due');
  });
});

describe('partial split display rows', () => {
  it('exposes outstanding when ledger covers part of the obligation', () => {
    const row = buildCustomerSplitDisplayRows(
      [{ name: 'Ana', amount: 27.45 }],
      [{ id: '1', person_index: 0, person_name: 'Ana', amount: 19.95, created_at: '', payment_method: null, payment_lines: null }],
    )[0]!;
    assert.equal(row.outstandingAmount, 7.5);
    assert.equal(row.settlementStatus, 'partial');
  });
});

describe('customerBillCallAmount', () => {
  const collected = [
    { id: '1', person_index: 0, person_name: '客人 1', amount: 659.7, created_at: '', payment_method: null, payment_lines: null },
  ];

  it('returns full total when no collections', () => {
    assert.equal(customerBillCallAmount({ total: 1319.4, collectedPayments: [] }), 1319.4);
  });

  it('returns total minus ledger after partial collection', () => {
    assert.equal(
      customerBillCallAmount({ total: 1319.4, collectedPayments: collected }),
      659.7,
    );
  });

  it('uses bill total minus collected even when person rows leave a pool gap', () => {
    assert.equal(
      customerBillCallAmount({
        total: 83.2,
        collectedPayments: [
          {
            id: '1',
            person_index: 0,
            person_name: '客人 1',
            amount: 69.17,
            created_at: '',
            payment_method: 'CASH',
          },
        ],
      }),
      14.03,
    );
  });
});
