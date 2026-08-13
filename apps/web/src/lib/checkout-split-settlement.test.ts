import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSplitSettlementRows,
  deriveSplitSettlementStatus,
  isMultiPersonSplitBill,
  isSplitSettlementPending,
  pendingSplitSettlementRows,
  splitSettlementCollectAmount,
  sumSplitSettlementOutstanding,
} from './checkout-split-settlement';

describe('deriveSplitSettlementStatus', () => {
  it('returns due when nothing is collected', () => {
    assert.equal(deriveSplitSettlementStatus(28.15, 0), 'due');
  });

  it('returns due for zero obligation with empty ledger', () => {
    assert.equal(deriveSplitSettlementStatus(0, 0), 'due');
  });

  it('returns settled only when ledger money covers the obligation', () => {
    assert.equal(deriveSplitSettlementStatus(28.15, 28.15), 'settled');
  });

  it('returns partial when ledger covers part of the obligation', () => {
    assert.equal(deriveSplitSettlementStatus(27.45, 19.95), 'partial');
  });
});

describe('buildSplitSettlementRows', () => {
  it('marks settled when ledger covers obligation', () => {
    const rows = buildSplitSettlementRows(
      [{ name: '客人 1', amount: 201.27 }],
      [{ id: '1', person_index: 0, person_name: '客人 1', amount: 201.27, created_at: '' }],
    );
    assert.equal(rows[0]?.settlementStatus, 'settled');
    assert.equal(rows[0]?.outstandingAmount, 0);
  });

  it('shows partial when obligation was inflated after resume merge bug', () => {
    const rows = buildSplitSettlementRows(
      [{ name: '客人 1', amount: 301.9 }],
      [{ id: '1', person_index: 0, person_name: '客人 1', amount: 201.27, created_at: '' }],
    );
    assert.equal(rows[0]?.settlementStatus, 'partial');
    assert.equal(rows[0]?.outstandingAmount, 100.63);
  });

  it('keeps three-way even obligations consistent after continuation', () => {
    const rows = buildSplitSettlementRows(
      [
        { name: '客人 1', amount: 201.27 },
        { name: '客人 2', amount: 201.27 },
        { name: '客人 3', amount: 201.26 },
      ],
      [{ id: '1', person_index: 0, person_name: '客人 1', amount: 201.27, created_at: '' }],
    );
    assert.equal(rows[0]?.settlementStatus, 'settled');
    assert.equal(sumSplitSettlementOutstanding(rows), 402.53);
    assert.deepEqual(
      pendingSplitSettlementRows(rows).map((row) => row.index),
      [1, 2],
    );
  });

  it('does not treat zero-obligation unpaid custom row as settled or pending', () => {
    const rows = buildSplitSettlementRows(
      [
        { name: '客人 1', amount: 0 },
        { name: '客人 2', amount: 28.15 },
      ],
      [],
    );
    assert.equal(rows[0]?.settlementStatus, 'due');
    assert.equal(rows[0]?.outstandingAmount, 0);
    assert.equal(isSplitSettlementPending(rows[0]!), false);
    assert.equal(rows[1]?.settlementStatus, 'due');
    assert.deepEqual(
      pendingSplitSettlementRows(rows).map((row) => row.index),
      [1],
    );
  });
});

describe('splitSettlementCollectAmount', () => {
  it('returns outstanding for partial rows', () => {
    const row = buildSplitSettlementRows(
      [{ name: 'Ana', amount: 27.45 }],
      [{ id: '1', person_index: 0, person_name: 'Ana', amount: 19.95, created_at: '' }],
    )[0]!;
    assert.equal(splitSettlementCollectAmount(row), 7.5);
  });
});

describe('isMultiPersonSplitBill', () => {
  it('is true when result has more than one row', () => {
    assert.equal(
      isMultiPersonSplitBill({
        result: [
          { name: 'jack', amount: 40 },
          { name: 'tom', amount: 20 },
        ],
      }),
      true,
    );
  });

  it('is false for whole-table single row', () => {
    assert.equal(isMultiPersonSplitBill({ result: [{ name: 'Total', amount: 60 }] }), false);
  });
});
