import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCustomerSplitDisplayRows,
  buildCustomerTableSettlementSummary,
  guestByItemPoolFullyCalled,
  guestByItemPoolFullyCalledFromSplit,
  orderCustomerTableSplitRows,
  type CustomerSplitRowDisplay,
} from './customer-bill-split-display';

describe('buildCustomerSplitDisplayRows', () => {
  it('shows partial continuation balance despite stale paid flag', () => {
    const rows = buildCustomerSplitDisplayRows(
      [
        { name: 'Ana', amount: 27.45, paid: true },
        { name: 'Tom', amount: 71.9 },
      ],
      [{ id: '1', party_id: null, person_index: 0, person_name: 'Ana', amount: 19.95, created_at: '', payment_method: null, payment_lines: null }],
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
      [{ id: '1', party_id: null, person_index: 0, person_name: 'Ana', amount: 31.7, created_at: '', payment_method: null, payment_lines: null }],
    );
    assert.equal(rows[0]?.settlementStatus, 'settled');
  });

  it('settles when ledger covers post-discount obligation', () => {
    const rows = buildCustomerSplitDisplayRows(
      [{ name: 'J', amount: 22.45 }],
      [{ id: '1', party_id: null, person_index: 0, person_name: 'J', amount: 20.21, created_at: '', payment_method: null, payment_lines: null }],
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
      [{ id: '1', party_id: null, person_index: 0, person_name: 'Ana', amount: 19.95, created_at: '', payment_method: null, payment_lines: null }],
    )[0]!;
    assert.equal(row.outstandingAmount, 7.5);
    assert.equal(row.settlementStatus, 'partial');
  });
});


describe('guestByItemPoolFullyCalled', () => {
  it('is true only when the table has money, nothing unclaimed, and called outstanding', () => {
    assert.equal(
      guestByItemPoolFullyCalled({ table: 42, unclaimed: 0, called: 42 }),
      true,
    );
    assert.equal(
      guestByItemPoolFullyCalled({ table: 42, unclaimed: 10, called: 32 }),
      false,
    );
    assert.equal(
      guestByItemPoolFullyCalled({ table: 42, unclaimed: 0, called: 0 }),
      false,
    );
    assert.equal(
      guestByItemPoolFullyCalled({ table: 0, unclaimed: 0, called: 0 }),
      false,
    );
  });

  it('reads from a by-item split + ledger via the sole summary', () => {
    const split = {
      id: 'bs1',
      restaurant_id: 'r1',
      session_id: 's1',
      table_id: 't1',
      display_name: 'A1',
      order_ids: [] as string[],
      status: 'requested' as const,
      split_mode: 'by_item' as const,
      persons: [],
      result: [{ name: '张三', amount: 28, party_id: 'p1' }],
      total_amount: 28,
      created_at: '',
    };
    assert.equal(
      guestByItemPoolFullyCalledFromSplit({
        split,
        collectedPayments: [],
        tableTotal: 28,
      }),
      true,
    );
    assert.equal(
      guestByItemPoolFullyCalledFromSplit({
        split: { ...split, split_mode: 'whole_table' },
        collectedPayments: [],
        tableTotal: 28,
      }),
      false,
    );
    const rows = buildCustomerSplitDisplayRows(split.result, [], 0, 28);
    assert.deepEqual(buildCustomerTableSettlementSummary(rows, 28), {
      table: 28,
      collected: 0,
      called: 28,
      unclaimed: 0,
    });
  });
});

describe('orderCustomerTableSplitRows', () => {
  const row = (
    name: string,
    settlementStatus: CustomerSplitRowDisplay['settlementStatus'],
    calledAt?: string,
    mine = false,
  ): CustomerSplitRowDisplay => ({
    name,
    obligationAmount: 1,
    collectedAmount: settlementStatus === 'settled' ? 1 : 0,
    outstandingAmount: settlementStatus === 'settled' ? 0 : 1,
    settlementStatus,
    mine,
    calledAt,
  });

  it('puts my unpaid ticket first, other unpaid next, settled last, newest call first per band', () => {
    const ordered = orderCustomerTableSplitRows([
      row('paid-old', 'settled', '2026-10-12T10:00:00Z'),
      row('other-old', 'due', '2026-10-12T10:05:00Z'),
      row('mine-paid', 'settled', '2026-10-12T10:20:00Z', true),
      row('other-new', 'due', '2026-10-12T10:30:00Z'),
      row('mine', 'due', '2026-10-12T10:10:00Z', true),
      row('paid-new', 'settled', '2026-10-12T10:25:00Z'),
    ]);
    assert.deepEqual(
      ordered.map((r) => r.name),
      ['mine', 'other-new', 'other-old', 'paid-new', 'mine-paid', 'paid-old'],
    );
  });

  it('treats a ticket without a call time as the oldest of its band', () => {
    const ordered = orderCustomerTableSplitRows([
      row('no-time', 'due'),
      row('timed', 'due', '2026-10-12T10:00:00Z'),
    ]);
    assert.deepEqual(ordered.map((r) => r.name), ['timed', 'no-time']);
  });
});
