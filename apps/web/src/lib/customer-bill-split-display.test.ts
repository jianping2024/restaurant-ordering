import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  billSplitDisplayResults,
  buildCustomerSplitDisplayRows,
  deriveCustomerSplitSettlementStatus,
  initialPersistedSplitResult,
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
      [{ id: '1', person_name: 'Ana', amount: 19.95, created_at: '' }],
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
      [{ id: '1', person_name: 'Ana', amount: 31.7, created_at: '' }],
    );
    assert.equal(rows[0]?.settlementStatus, 'settled');
  });
});
