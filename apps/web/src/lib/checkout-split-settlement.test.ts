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
      [{ id: '1', person_index: 0, person_name: '客人 1', amount: 201.27, created_at: '', payment_method: null, payment_lines: null }],
    );
    assert.equal(rows[0]?.settlementStatus, 'settled');
    assert.equal(rows[0]?.outstandingAmount, 0);
  });

  it('applies discountRate inside obligation — sole fold for settlement status', () => {
    // Pre-discount 22.45 @ 10% → 20.21; collecting 20.21 must settle (not leave €2.24 partial).
    const rows = buildSplitSettlementRows(
      [{ name: 'J', amount: 22.45 }],
      [{ id: '1', person_index: 0, person_name: 'J', amount: 20.21, created_at: '', payment_method: null, payment_lines: null }],
      10,
    );
    assert.equal(rows[0]?.obligationAmount, 20.21);
    assert.equal(rows[0]?.settlementStatus, 'settled');
    assert.equal(rows[0]?.outstandingAmount, 0);
  });

  it('multi-person discount: last ticket matches one-cut allocate (no freeze reshuffle)', () => {
    const rows = buildSplitSettlementRows(
      [
        { name: 'John', amount: 22.45 },
        { name: 'Tom', amount: 33 },
        { name: 'J', amount: 1.85 },
      ],
      [
        { id: '1', person_index: 0, person_name: 'John', amount: 20.21, created_at: '', payment_method: null, payment_lines: null },
        { id: '2', person_index: 1, person_name: 'Tom', amount: 29.7, created_at: '', payment_method: null, payment_lines: null },
      ],
      10,
      57.3,
    );
    assert.equal(rows[0]?.settlementStatus, 'settled');
    assert.equal(rows[1]?.settlementStatus, 'settled');
    assert.equal(rows[2]?.obligationAmount, 1.66);
    assert.equal(rows[2]?.outstandingAmount, 1.66);
    assert.equal(rows[2]?.settlementStatus, 'due');
  });

  it('five-way sequential: Marry obligation stays 3.50 while first four paid at one-cut', () => {
    const pre = [
      { name: 'John', amount: 19.95 },
      { name: 'Tom', amount: 28.18 },
      { name: 'Jim', amount: 8.4 },
      { name: 'Jimmy', amount: 1.23 },
      { name: 'Marry', amount: 3.89 },
    ];
    const rows = buildSplitSettlementRows(
      pre,
      [
        { id: '1', person_index: 0, person_name: 'John', amount: 17.96, created_at: '', payment_method: null, payment_lines: null },
        { id: '2', person_index: 1, person_name: 'Tom', amount: 25.37, created_at: '', payment_method: null, payment_lines: null },
        { id: '3', person_index: 2, person_name: 'Jim', amount: 7.56, created_at: '', payment_method: null, payment_lines: null },
        { id: '4', person_index: 3, person_name: 'Jimmy', amount: 1.1, created_at: '', payment_method: null, payment_lines: null },
      ],
      10,
      61.65,
    );
    assert.equal(rows[3]?.obligationAmount, 1.1);
    assert.equal(rows[3]?.settlementStatus, 'settled');
    assert.equal(rows[4]?.obligationAmount, 3.5);
    assert.equal(rows[4]?.outstandingAmount, 3.5);
    const collected = 17.96 + 25.37 + 7.56 + 1.1;
    assert.equal(Number((55.49 - collected).toFixed(2)), 3.5);
  });

  it('without discountRate, same ledger against pre-discount looks partial', () => {
    const rows = buildSplitSettlementRows(
      [{ name: 'J', amount: 22.45 }],
      [{ id: '1', person_index: 0, person_name: 'J', amount: 20.21, created_at: '', payment_method: null, payment_lines: null }],
    );
    assert.equal(rows[0]?.settlementStatus, 'partial');
    assert.equal(rows[0]?.outstandingAmount, 2.24);
  });

  it('shows partial when obligation was inflated after resume merge bug', () => {
    const rows = buildSplitSettlementRows(
      [{ name: '客人 1', amount: 301.9 }],
      [{ id: '1', person_index: 0, person_name: '客人 1', amount: 201.27, created_at: '', payment_method: null, payment_lines: null }],
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
      [{ id: '1', person_index: 0, person_name: '客人 1', amount: 201.27, created_at: '', payment_method: null, payment_lines: null }],
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
      [{ id: '1', person_index: 0, person_name: 'Ana', amount: 19.95, created_at: '', payment_method: null, payment_lines: null }],
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
