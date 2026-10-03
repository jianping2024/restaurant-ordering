import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit } from '@/types';
import {
  applyByItemConsumerRowEdit,
  applyByItemConsumerRowRemove,
  allocationLockedTicketKeys,
  buildByItemConsumerRowsFromPersons,
  buildLockedPersonLineMins,
  byItemRowEditLock,
  commitAllByItemAllocations,
  commitByItemConsumerRowEdit,
  ensureSplitPersonNames,
  isCheckoutSplitLocked,
  isPausedCheckoutSplit,
  lockedPersonLineKey,
  paidSplitPersonNames,
  shouldShowCheckoutSubmitted,
  lockedSplitRowCount,
  splitDraftPersonCount,
  defaultSplitPersonNames,
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
  it('locks paidLocked row as exact read-only (no qty bump-merge)', () => {
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
      row: {
        id: 'r1',
        name: 'Ana',
        qtyWhole: '1',
        qtyNum: '',
        qtyDen: '',
        paidLocked: true,
      },
      locks,
      spec: menuSpec(LINE_KEY, 3),
    });
    assert.equal(lock.nameReadOnly, true);
    assert.equal(lock.removable, false);
    assert.equal(lock.qtyReadOnly, true);
    assert.ok(lock.minMenuQty);
    assert.equal(lock.minMenuQty?.num, 1);
  });
});

describe('applyByItemConsumerRowEdit', () => {
  it('rejects qty clear when qtyReadOnly; commit keeps exact locked share', () => {
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
    const typing = applyByItemConsumerRowEdit({
      row: { id: 'r1', name: 'Jack', qtyWhole: '1', qtyNum: '', qtyDen: '' },
      patch: { qtyWhole: '', qtyNum: '', qtyDen: '' },
      ctx,
    });
    assert.equal(typing.qtyWhole, '1');

    const committed = commitByItemConsumerRowEdit({
      row: typing,
      ctx,
    });
    assert.equal(committed.qtyWhole, '1');
  });

  it('rejects qty bump when qtyReadOnly; commit restores exact locked share', () => {
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
    const ctx = { lineKey: LINE_KEY, spec: menuSpec(LINE_KEY, 11), locks };
    const typing = applyByItemConsumerRowEdit({
      row: { id: 'r1', name: 'Jack', qtyWhole: '1', qtyNum: '', qtyDen: '' },
      patch: { qtyWhole: '13', qtyNum: '', qtyDen: '' },
      ctx,
    });
    assert.equal(typing.qtyWhole, '1');

    const drifted = {
      id: 'r1',
      name: 'Jack',
      qtyWhole: '13',
      qtyNum: '',
      qtyDen: '',
      paidLocked: true as const,
    };
    const committed = commitByItemConsumerRowEdit({ row: drifted, ctx });
    assert.equal(committed.qtyWhole, '1');
  });

  it('allows qty edit for unlocked unpaid guest', () => {
    const locks = { menu: new Map(), buffet: new Map() };
    const ctx = { lineKey: LINE_KEY, spec: menuSpec(LINE_KEY, 4), locks };
    const typing = applyByItemConsumerRowEdit({
      row: { id: 'r1', name: 'Bob', qtyWhole: '1', qtyNum: '', qtyDen: '' },
      patch: { qtyWhole: '2', qtyNum: '', qtyDen: '' },
      ctx,
    });
    assert.equal(typing.qtyWhole, '2');
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

describe('commitAllByItemAllocations', () => {
  it('restores exact locked shares on every line before submit', () => {
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
    const committed = commitAllByItemAllocations({
      allocations: {
        [LINE_KEY]: [{ id: 'r1', name: 'Jack', qtyWhole: '', qtyNum: '', qtyDen: '' }],
      },
      lineSpecs: [menuSpec(LINE_KEY, 4)],
      locks,
    });
    assert.equal(committed[LINE_KEY]?.[0]?.qtyWhole, '1');
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

describe('allocationLockedTicketKeys', () => {
  it('locks paid party_id without locking same-name unpaid ticket', () => {
    const paidId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const unpaidId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const keys = allocationLockedTicketKeys(
      split({
        split_mode: 'by_item',
        result: [
          { name: '客人1', amount: 19.95, paid: true, party_id: paidId },
          { name: '客人1', amount: 2.2, party_id: unpaidId },
        ],
      }),
      [],
    );
    assert.equal(keys.has(`p:${paidId}`), true);
    assert.equal(keys.has(`p:${unpaidId}`), false);
  });

  it('locks ticket with locked_amount before collection / result.paid', () => {
    const stampedId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const openId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const keys = allocationLockedTicketKeys(
      split({
        split_mode: 'by_item',
        persons: [
          {
            name: '客人1',
            party_id: stampedId,
            item_shares: [
              { key: 'cola', qty_num: 1, qty_den: 1, locked_amount: 2.2 },
            ],
          },
          {
            name: '客人1',
            party_id: openId,
            item_shares: [{ key: 'tea', qty_num: 1, qty_den: 1 }],
          },
        ],
        result: [
          { name: '客人1', amount: 2.2, party_id: stampedId },
          { name: '客人1', amount: 1.5, party_id: openId },
        ],
      }),
      [],
    );
    assert.equal(keys.has(`p:${stampedId}`), true);
    assert.equal(keys.has(`p:${openId}`), false);
  });
});

describe('splitDraftPersonCount', () => {
  it('defaults even to 2 and custom to 1', () => {
    assert.equal(splitDraftPersonCount('even'), 2);
    assert.equal(splitDraftPersonCount('custom'), 1);
  });

  it('clamps even ≥2 and custom ≥1 with cap 20', () => {
    assert.equal(splitDraftPersonCount('even', 1), 2);
    assert.equal(splitDraftPersonCount('custom', 0), 1);
    assert.equal(splitDraftPersonCount('even', 3), 3);
    assert.equal(splitDraftPersonCount('custom', 3), 3);
    assert.equal(splitDraftPersonCount('even', 99), 20);
    assert.equal(splitDraftPersonCount('custom', 99), 20);
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

  it('returns null for whole_table so drafts seed the default roster', () => {
    assert.equal(
      resolveContinuationSplitShape(
        split({
          split_mode: 'whole_table',
          persons: [{ name: '__whole_table__' }],
          result: [{ name: '__whole_table__', amount: 40 }],
        }),
        (n) => `Guest ${n}`,
      ),
      null,
    );
  });

  it('pads even shape with one real guest to at least 2 people', () => {
    const shape = resolveContinuationSplitShape(
      split({
        split_mode: 'even',
        persons: [{ name: 'Ana' }],
        result: [{ name: 'Ana', amount: 40 }],
      }),
      (n) => `Guest ${n}`,
    );
    assert.equal(shape?.personCount, 2);
    assert.deepEqual(shape?.personNames, ['Ana', 'Guest 2']);
  });

  it('keeps custom shape at one person without padding to 2', () => {
    const shape = resolveContinuationSplitShape(
      split({
        split_mode: 'custom',
        persons: [{ name: 'Ana' }],
        result: [{ name: 'Ana', amount: 40 }],
      }),
      (n) => `Guest ${n}`,
    );
    assert.equal(shape?.personCount, 1);
    assert.deepEqual(shape?.personNames, ['Ana']);
  });

  it('returns null when split is missing', () => {
    assert.equal(resolveContinuationSplitShape(null, (n) => `Guest ${n}`), null);
  });
});

describe('defaultSplitPersonNames', () => {
  it('seeds even with 2 guests and custom with 1', () => {
    assert.deepEqual(defaultSplitPersonNames((n) => `Guest ${n}`, 'even'), [
      'Guest 1',
      'Guest 2',
    ]);
    assert.deepEqual(defaultSplitPersonNames((n) => `Guest ${n}`, 'custom'), [
      'Guest 1',
    ]);
  });
});

describe('ensureSplitPersonNames', () => {
  it('pads truncates and replaces blank or whole-table names', () => {
    assert.deepEqual(
      ensureSplitPersonNames(['Ana', '__whole_table__'], 3, (n) => `Guest ${n}`),
      ['Ana', 'Guest 2', 'Guest 3'],
    );
    assert.deepEqual(
      ensureSplitPersonNames(['A', 'B', 'C'], 2, (n) => `Guest ${n}`),
      ['A', 'B'],
    );
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

  it('rejects increasing locked guest qty on same line', () => {
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
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.issue, 'locked_allocation_changed');
  });

  it('rejects omitting a paid ticket from incoming result', () => {
    const paidId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const unpaidId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const existing = split({
      result: [
        { name: 'Ana', amount: 10, paid: true, party_id: paidId },
        { name: 'Bob', amount: 10, party_id: unpaidId },
      ],
      persons: [
        {
          name: 'Ana',
          party_id: paidId,
          item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1, locked_amount: 10 }],
        },
        {
          name: 'Bob',
          party_id: unpaidId,
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
            party_id: paidId,
            item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1, locked_amount: 10 }],
          },
          {
            name: 'Bob',
            party_id: unpaidId,
            item_shares: [{ key: LINE_KEY, qty_num: 1, qty_den: 1 }],
          },
        ],
        result: [{ name: 'Bob', amount: 10, party_id: unpaidId }],
      },
      lineSpecs: [menuSpec(LINE_KEY, 2)],
      hasCollectedLedger: false,
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.issue, 'locked_allocation_changed');
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
