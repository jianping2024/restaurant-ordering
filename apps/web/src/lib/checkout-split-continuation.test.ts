import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BillSplit } from '@/types';
import {
  buildByItemConsumerRowsFromPersons,
  isCheckoutSplitLocked,
  isPausedCheckoutSplit,
  lockedByItemLineKeys,
  paidSplitPersonNames,
  shouldShowCheckoutSubmitted,
  lockedSplitRowCount,
  resolveContinuationSplitShape,
  validateCheckoutContinuation,
} from './checkout-split-continuation';
import type { ByItemLineSpec } from './bill-split-by-item-lines';

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

const menuSpec = (key: string): ByItemLineSpec => ({
  mode: 'menu',
  key,
  lineQty: 1,
  unitPrice: 10,
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

describe('lockedByItemLineKeys', () => {
  it('collects keys only for paid guests', () => {
    const keys = lockedByItemLineKeys(
      split({
        result: [
          { name: 'John', amount: 10, paid: true },
          { name: 'Mary', amount: 10, paid: false },
        ],
        persons: [
          {
            name: 'John',
            item_shares: [{ key: 'o1-0', qty_num: 1, qty_den: 1 }],
          },
          {
            name: 'Mary',
            item_shares: [{ key: 'o1-1', qty_num: 1, qty_den: 1 }],
          },
        ],
      }),
    );
    assert.equal(keys.has('o1-0'), true);
    assert.equal(keys.has('o1-1'), false);
  });

  it('locks ledger guests even when paid flag was reconciled off', () => {
    const keys = lockedByItemLineKeys(
      split({
        result: [
          { name: 'Ana', amount: 30, paid: false },
          { name: 'Bob', amount: 10 },
        ],
        persons: [
          {
            name: 'Ana',
            item_shares: [{ key: 'o1-0', qty_num: 1, qty_den: 1 }],
          },
          {
            name: 'Bob',
            item_shares: [{ key: 'o1-1', qty_num: 1, qty_den: 1 }],
          },
        ],
      }),
      true,
      [{ id: '1', person_name: 'Ana', amount: 20, created_at: '' }],
    );
    assert.equal(keys.has('o1-0'), true);
    assert.equal(keys.has('o1-1'), false);
  });

  it('locks all assigned keys when ledger exists without paid rows', () => {
    const keys = lockedByItemLineKeys(
      split({
        persons: [
          {
            name: 'John',
            item_shares: [{ key: 'o1-0', qty_num: 1, qty_den: 1 }],
          },
          {
            name: 'Mary',
            item_shares: [{ key: 'o1-1', qty_num: 1, qty_den: 1 }],
          },
        ],
      }),
      true,
    );
    assert.equal(keys.has('o1-0'), true);
    assert.equal(keys.has('o1-1'), true);
  });

  it('returns empty when no collection has started', () => {
    const keys = lockedByItemLineKeys(
      split({
        persons: [
          {
            name: 'John',
            item_shares: [{ key: 'o1-0', qty_num: 1, qty_den: 1 }],
          },
        ],
      }),
    );
    assert.equal(keys.size, 0);
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

  it('rejects changed allocation on locked line', () => {
    const existing = split({
      result: [{ name: 'John', amount: 10, paid: true }],
      persons: [
        {
          name: 'John',
          item_shares: [{ key: 'o1-0', qty_num: 1, qty_den: 1 }],
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
            item_shares: [{ key: 'o1-0', qty_num: 1, qty_den: 1 }],
          },
        ],
        result: [{ name: 'Mary', amount: 10 }],
      },
      lineSpecs: [menuSpec('o1-0')],
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
          item_shares: [{ key: 'o1-0', qty_num: 1, qty_den: 1 }],
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
            item_shares: [{ key: 'o1-0', qty_num: 1, qty_den: 1 }],
          },
        ],
        result: [{ name: 'Mary', amount: 10 }],
      },
      lineSpecs: [menuSpec('o1-0')],
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
          item_shares: [{ key: 'o1-0', qty_num: 1, qty_den: 1 }],
        },
      ],
      [menuSpec('o1-0')],
    );
    assert.equal(rows['o1-0']?.[0]?.name, 'John');
    assert.equal(rows['o1-0']?.[0]?.qtyWhole, '1');
  });
});
