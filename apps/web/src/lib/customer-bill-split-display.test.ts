import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCustomerSplitDisplayRows } from './customer-bill-split-display';

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

  it('keeps zero-obligation row due when ledger is empty', () => {
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

