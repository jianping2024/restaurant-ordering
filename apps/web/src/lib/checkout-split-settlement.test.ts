import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSplitSettlementRows,
  pendingSplitSettlementRows,
  splitSettlementCollectAmount,
  sumSplitSettlementOutstanding,
} from './checkout-split-settlement';

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
