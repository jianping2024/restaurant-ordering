import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit } from '@/types';
import {
  applyByItemConsumerRowEdit,
  applyByItemConsumerRowRemove,
  buildByItemConsumerRowsFromPersons,
  buildLockedPersonLineMins,
  byItemRowEditLock,
  clampMenuRowToMinQty,
  isCheckoutSplitLocked,
  isPausedCheckoutSplit,
  lockedPersonLineKey,
  paidSplitPersonNames,
  shouldShowCheckoutSubmitted,
  lockedSplitRowCount,
  resolveContinuationSplitShape,
  validateCheckoutContinuation,
} from './checkout-split-continuation';
import type { ByItemLineSpec } from './bill-split-by-item-lines';

const LINE_KEY = 'd1::10';

function split(overrides: Partial<BillSplit> = {}): BillSplit {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    restaurant_id: '11111111-1111-4111-8111-111111111111',
    order_ids: [],
    split_mode: 'by_item',
    persons: [],
    result: [],
    total_amount: 0,
    status: 'confirmed',
    created_at: '2026-05-29T00:00:00.000Z',
    session_id: '44444444-4444-4444-8444-444444444444',
    table_id: '33333333-3333-4333-8333-333333333333',
    display_name: 'A-01',
    ...overrides,
  };
}

const menuSpec = (key: string, lineQty = 1): ByItemLineSpec => ({
  mode: 'menu',
  key,
  lineQty,
  unitPrice: 10,
  lineTotal: lineQty * 10,
});

describe('isPausedCheckoutSplit', () => {
  it('detects confirmed split on open session', () => {
    assert.equal(isPausedCheckoutSplit(split({ status: 'confirmed' }), 'open'), true);
    assert.equal(isPausedCheckoutSplit(split({ status: 'requested' }), 'open'), false);
  });
});

describe('shouldShowCheckoutSubmitted', () => {
  it('hides success screen during paused continuation', () => {
    assert.equal(shouldShowCheckoutSubmitted(split({ status: 'confirmed' }), 'open'), false);
    assert.equal(shouldShowCheckoutSubmitted(split({ status: 'requested' }), 'billing'), true);
  });
});

describe('isCheckoutSplitLocked', () => {
  it('locks only after collection has started', () => {
    assert.equal(isCheckoutSplitLocked(split({ result: [{ name: 'A', amount: 10, paid: true }] }), false), true);
    assert.equal(isCheckoutSplitLocked(split(), true), true);
    assert.equal(isCheckoutSplitLocked(split({ status: 'confirmed' }), false), false);
    assert.equal(isCheckoutSplitLocked(split(), false), false);
  });
});

describe('buildLockedPersonLineMins', () => {
  it('records min qty only for paid guests on their lines', () => {
    const locked = buildLockedPersonLineMins(
      split({
        result: [
          { name: 'John', amount: 10, paid: true },
          { name: 'Mary', amount: 10, paid: false },
        ],
        persons: [
          {
            name: 'John',
            item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
          },
          {
            name: 'Mary',
            item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
          },
        ],
      }),
    );
    assert.ok(locked.menu.has(lockedPersonLineKey(LINE_KEY, 'John')));
    assert.equal(locked.menu.has(lockedPersonLineKey(LINE_KEY, 'Mary')), false);
  });

  it('locks ledger guests even when paid flag was reconciled off', () => {
    const locked = buildLockedPersonLineMins(
      split({
        result: [
          { name: 'Ana', amount: 30, paid: false },
          { name: 'Bob', amount: 10 },
        ],
        persons: [
          {
            name: 'Ana',
            item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
          },
          {
            name: 'Bob',
            item_shares: [{ key: 'd2::8', qty_num: 1, qty_den: 1 }],
          },
        ],
      }),
      true,
      [{ id: '1', person_name: 'Ana', amount: 20, created_at: '' }],
    );
    assert.ok(locked.menu.has(lockedPersonLineKey(LINE_KEY, 'Ana')));
    assert.equal(locked.menu.has(lockedPersonLineKey('d2::8', 'Bob')), false);
  });

  it('locks all assigned mins when ledger exists without paid rows', () => {
    const locked = buildLockedPersonLineMins(
      split({
        persons: [
          {
            name: 'John',
            item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
          },
          {
            name: 'Mary',
            item_shares: [{ key: 'd2::8', qty_num: 1, qty_den: 1 }],
          },
        ],
      }),
      true,
    );
    assert.ok(locked.menu.has(lockedPersonLineKey(LINE_KEY, 'John')));
    assert.ok(locked.menu.has(lockedPersonLineKey('d2::8', 'Mary')));
  });

  it('returns empty when no collection has started', () => {
    const locked = buildLockedPersonLineMins(
      split({
        persons: [
          {
            name: 'John',
            item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
          },
        ],
      }),
    );
    assert.equal(locked.menu.size, 0);
  });
});

describe('byItemRowEditLock', () => {
  it('locks name and removal but allows qty increase for paid share', () => {
    const locks = buildLockedPersonLineMins(
      split({
        result: [{ name: 'Ana', amount: 10, paid: true }],
        persons: [
          {
            name: 'Ana',
            item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
          },
        ],
      }),
    );
    const lock = byItemRowEditLock({
      lineKey: LINE_KEY,
      row: { id: 'r1', name: 'Ana', qtyWhole: '1', qtyNum: '', qtyDen: '' },
      locks,
      spec: menuSpec(LINE_KEY, 3),
    });
    assert.equal(lock.nameReadOnly, true);
    assert.equal(lock.removable, false);
    assert.ok(lock.minMenuQty);
    assert.equal(lock.minMenuQty?.num, 1);
  });
});

describe('clampMenuRowToMinQty', () => {
  it('restores locked floor when qty is cleared', () => {
    const row = clampMenuRowToMinQty(
      { id: 'r1', name: 'Jack', qtyWhole: '', qtyNum: '', qtyDen: '' },
      { num: 1, den: 1 },
    );
    assert.equal(row.qtyWhole, '1');
  });

  it('allows qty above the locked floor', () => {
    const row = clampMenuRowToMinQty(
      { id: 'r1', name: 'Jack', qtyWhole: '2', qtyNum: '', qtyDen: '' },
      { num: 1, den: 1 },
    );
    assert.equal(row.qtyWhole, '2');
  });
});

describe('applyByItemConsumerRowEdit', () => {
  it('blocks lowering paid guest qty below floor after resume append', () => {
    const locks = buildLockedPersonLineMins(
      split({
        result: [{ name: 'Jack', amount: 2.2, paid: true }],
        persons: [
          {
            name: 'Jack',
            item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
          },
        ],
      }),
    );
    const ctx = { lineKey: LINE_KEY, spec: menuSpec(LINE_KEY, 4), locks };
    const next = applyByItemConsumerRowEdit({
      row: { id: 'r1', name: 'Jack', qtyWhole: '1', qtyNum: '', qtyDen: '' },
      patch: { qtyWhole: '', qtyNum: '', qtyDen: '' },
      ctx,
    });
    assert.equal(next.qtyWhole, '1');
  });

  it('ignores rename for locked paid guest', () => {
    const locks = buildLockedPersonLineMins(
      split({
        result: [{ name: 'Jack', amount: 2.2, paid: true }],
        persons: [
          {
            name: 'Jack',
            item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
          },
        ],
      }),
    );
    const ctx = { lineKey: LINE_KEY, spec: menuSpec(LINE_KEY, 4), locks };
    const next = applyByItemConsumerRowEdit({
      row: { id: 'r1', name: 'Jack', qtyWhole: '1', qtyNum: '', qtyDen: '' },
      patch: { name: 'Smith' },
      ctx,
    });
    assert.equal(next.name, 'Jack');
  });
});

describe('applyByItemConsumerRowRemove', () => {
  it('keeps paid guest row when removal is forbidden', () => {
    const locks = buildLockedPersonLineMins(
      split({
        result: [{ name: 'Jack', amount: 2.2, paid: true }],
        persons: [
          {
            name: 'Jack',
            item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
          },
        ],
      }),
    );
    const rows = [
      { id: 'r1', name: 'Jack', qtyWhole: '1', qtyNum: '', qtyDen: '' },
      { id: 'r2', name: 'Smith', qtyWhole: '3', qtyNum: '', qtyDen: '' },
    ];
    const ctx = { lineKey: LINE_KEY, spec: menuSpec(LINE_KEY, 4), locks };
    const next = applyByItemConsumerRowRemove({ rows, rowId: 'r1', ctx });
    assert.equal(next.length, 2);
    assert.equal(next[0]?.name, 'Jack');
  });

  it('allows removing unpaid guest row', () => {
    const locks = buildLockedPersonLineMins(
      split({
        result: [{ name: 'Jack', amount: 2.2, paid: true }],
        persons: [
          {
            name: 'Jack',
            item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
          },
          {
            name: 'Smith',
            item_shares: [{ key: LINE_KEY, qty_num: 3, qty_den: 1 }],
          },
        ],
      }),
    );
    const rows = [
      { id: 'r1', name: 'Jack', qtyWhole: '1', qtyNum: '', qtyDen: '' },
      { id: 'r2', name: 'Smith', qtyWhole: '3', qtyNum: '', qtyDen: '' },
    ];
    const ctx = { lineKey: LINE_KEY, spec: menuSpec(LINE_KEY, 4), locks };
    const next = applyByItemConsumerRowRemove({ rows, rowId: 'r2', ctx });
    assert.equal(next.length, 1);
    assert.equal(next[0]?.name, 'Jack');
  });
});

describe('paidSplitPersonNames', () => {
  it('normalizes paid guest names', () => {
    const names = paidSplitPersonNames(
      split({ result: [{ name: ' John ', amount: 5, paid: true }] }),
    );
    assert.equal(names.has('john'), true);
  });
});

describe('resolveContinuationSplitShape', () => {
  it('hydrates person count from result when persons is empty', () => {
    const shape = resolveContinuationSplitShape(
      split({
        split_mode: 'even',
        persons: [],
        result: [
          { name: '客人 1', amount: 201.27 },
          { name: '客人 2', amount: 201.27 },
          { name: '客人 3', amount: 201.26 },
        ],
      }),
      (n) => `Guest ${n}`,
    );
    assert.equal(shape?.personCount, 3);
    assert.deepEqual(shape?.personNames, ['客人 1', '客人 2', '客人 3']);
  });

  it('returns null when split is missing', () => {
    assert.equal(resolveContinuationSplitShape(null, (n) => `Guest ${n}`), null);
  });
});

describe('validateCheckoutContinuation', () => {
  it('rejects split mode change after partial pay', () => {
    const existing = split({
      result: [{ name: 'John', amount: 10, paid: true }],
      persons: [{ name: 'John' }],
    });
    const out = validateCheckoutContinuation({
      existing,
      payload: {
        splitMode: 'even',
        persons: [{ name: 'John' }, { name: 'Mary' }],
        result: [
          { name: 'John', amount: 10 },
          { name: 'Mary', amount: 10 },
        ],
      },
      lineSpecs: [],
      hasCollectedLedger: false,
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.issue, 'split_mode_locked');
  });

  it('rejects reassigned locked share', () => {
    const existing = split({
      result: [{ name: 'John', amount: 10, paid: true }],
      persons: [
        {
          name: 'John',
          item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
        },
      ],
    });
    const out = validateCheckoutContinuation({
      existing,
      payload: {
        splitMode: 'by_item',
        persons: [
          {
            name: 'Mary',
            item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
          },
        ],
        result: [{ name: 'Mary', amount: 10 }],
      },
      lineSpecs: [menuSpec(LINE_KEY)],
      hasCollectedLedger: false,
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.issue, 'locked_allocation_changed');
  });

  it('allows increasing locked guest qty on same line', () => {
    const existing = split({
      result: [{ name: 'Ana', amount: 10, paid: true }],
      persons: [
        {
          name: 'Ana',
          item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
        },
      ],
    });
    const out = validateCheckoutContinuation({
      existing,
      payload: {
        splitMode: 'by_item',
        persons: [
          {
            name: 'Ana',
            item_shares: [{ key: LINE_KEY, qty_num: 2, qty_den: 1 }],
          },
        ],
        result: [{ name: 'Ana', amount: 20 }],
      },
      lineSpecs: [menuSpec(LINE_KEY, 3)],
      hasCollectedLedger: false,
    });
    assert.equal(out.ok, true);
  });

  it('allows changed allocation after resume when nothing was collected', () => {
    const existing = split({
      status: 'confirmed',
      persons: [
        {
          name: 'John',
          item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
        },
      ],
    });
    const out = validateCheckoutContinuation({
      existing,
      payload: {
        splitMode: 'by_item',
        persons: [
          {
            name: 'Mary',
            item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
          },
        ],
        result: [{ name: 'Mary', amount: 10 }],
      },
      lineSpecs: [menuSpec(LINE_KEY)],
      hasCollectedLedger: false,
    });
    assert.equal(out.ok, true);
  });

  it('rejects row count change after collections started', () => {
    const existing = split({
      split_mode: 'even',
      result: [
        { name: '客人 1', amount: 201.27, paid: true },
        { name: '客人 2', amount: 201.27 },
        { name: '客人 3', amount: 201.26 },
      ],
    });
    const out = validateCheckoutContinuation({
      existing,
      payload: {
        splitMode: 'even',
        persons: [{ name: '客人 1' }, { name: '客人 2' }],
        result: [
          { name: '客人 1', amount: 301.9 },
          { name: '客人 2', amount: 301.9 },
        ],
      },
      lineSpecs: [],
      hasCollectedLedger: true,
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.issue, 'split_shape_locked');
    assert.equal(lockedSplitRowCount(existing), 3);
  });
});

describe('buildByItemConsumerRowsFromPersons', () => {
  it('hydrates menu line qty fields', () => {
    const rows = buildByItemConsumerRowsFromPersons(
      [
        {
          name: 'John',
          item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
        },
      ],
      [menuSpec(LINE_KEY)],
    );
    assert.equal(rows[LINE_KEY]?.[0]?.name, 'John');
    assert.equal(rows[LINE_KEY]?.[0]?.qtyWhole, '1');
  });
});
