import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { billOrdersFingerprint, isBillOrdersComplete } from './customer-bill-sync';
import { computeSplitResults, validateSplitDraft } from './bill-split-draft';
import { resolveInitialSplitMode } from './use-bill-split-draft';
import type { BillSplitOrderLine, ByItemLineSpec } from './bill-split-by-item-lines';
import type { Order } from '../types';

function menuLine(key: string, qty: number, price: number): BillSplitOrderLine {
  return {
    key,
    order_id: 'o1',
    id: 'm1',
    qty,
    price,
    name: 'Dish',
    name_pt: 'Dish',
    emoji: '',
    kind: 'menu',
  };
}

function menuSpec(key: string, qty: number, price: number): ByItemLineSpec {
  return {
    mode: 'menu',
    key,
    lineQty: qty,
    lineTotal: qty * price,
    unitPrice: price,
  };
}

describe('billOrdersFingerprint', () => {
  it('detects added order lines', () => {
    const base: Order[] = [
      {
        id: 'o1',
        items: [{ id: 'm1', qty: 1, price: 10, name: 'A', name_pt: 'A', emoji: '', kind: 'menu' }],
      } as Order,
    ];
    const withExtra: Order[] = [
      ...base,
      {
        id: 'o2',
        items: [{ id: 'm2', qty: 1, price: 5, name: 'B', name_pt: 'B', emoji: '', kind: 'menu' }],
      } as Order,
    ];
    assert.notEqual(billOrdersFingerprint(base), billOrdersFingerprint(withExtra));
    assert.equal(isBillOrdersComplete(base, withExtra), false);
    assert.equal(isBillOrdersComplete(base, base), true);
  });
});

describe('computeSplitResults', () => {
  it('splits €10 evenly across 3 with cent remainder', () => {
    const people = [{ name: 'C' }, { name: 'A' }, { name: 'B' }];
    const rows = computeSplitResults({
      splitMode: 'even',
      total: 10,
      orderLines: [menuLine('o1-0', 1, 10)],
      lineSpecs: [menuSpec('o1-0', 1, 10)],
      personCount: 3,
      splitPeople: people,
      customAmounts: [],
      parsedByItemAllocations: {},
      wholeTableLabel: 'Total',
    });
    const sum = rows.reduce((s, r) => s + r.amount, 0);
    assert.equal(sum, 10);
    assert.equal(rows.length, 3);
  });

  it('recalculates even split when total changes', () => {
    const people = [{ name: 'Guest 1' }, { name: 'Guest 2' }];
    const low = computeSplitResults({
      splitMode: 'even',
      total: 20,
      orderLines: [menuLine('o1-0', 2, 10)],
      lineSpecs: [menuSpec('o1-0', 2, 10)],
      personCount: 2,
      splitPeople: people,
      customAmounts: [],
      parsedByItemAllocations: {},
      wholeTableLabel: 'Total',
    });
    const high = computeSplitResults({
      splitMode: 'even',
      total: 30,
      orderLines: [menuLine('o1-0', 3, 10)],
      lineSpecs: [menuSpec('o1-0', 3, 10)],
      personCount: 2,
      splitPeople: people,
      customAmounts: [],
      parsedByItemAllocations: {},
      wholeTableLabel: 'Total',
    });
    assert.equal(low[0]?.amount, 10);
    assert.equal(high[0]?.amount, 15);
    assert.equal(low[0]?.name, 'Guest 1');
  });
});

describe('validateSplitDraft', () => {
  it('flags unassigned lines after a new dish appears', () => {
    const specs = [menuSpec('o1-0', 1, 10), menuSpec('o2-0', 1, 8)];
    const lines = [menuLine('o1-0', 1, 10), menuLine('o2-0', 1, 8)];
    const outcome = validateSplitDraft({
      splitMode: 'by_item',
      total: 18,
      orderLines: lines,
      lineSpecs: specs,
      personCount: 2,
      splitPeople: [{ name: 'Guest 1' }, { name: 'Guest 2' }],
      customAmounts: [],
      parsedByItemAllocations: {
        'o1-0': [{ name: 'Guest 1', qty: { num: 1, den: 1 } }],
      },
      wholeTableLabel: 'Total',
    });
    assert.equal(outcome.validation.ok, false);
    if (!outcome.validation.ok) {
      assert.equal(outcome.validation.issue, 'unassigned_items');
    }
  });

  it('flags custom amounts when manual share exceeds total', () => {
    const outcome = validateSplitDraft({
      splitMode: 'custom',
      total: 30,
      orderLines: [menuLine('o1-0', 3, 10)],
      lineSpecs: [menuSpec('o1-0', 3, 10)],
      personCount: 2,
      splitPeople: [{ name: 'Guest 1' }, { name: 'Guest 2' }],
      customAmounts: [
        { name: 'Guest 1', amount: 35 },
        { name: 'Guest 2', amount: 0 },
      ],
      parsedByItemAllocations: {},
      wholeTableLabel: 'Total',
    });
    assert.equal(outcome.validation.ok, false);
    if (!outcome.validation.ok) {
      assert.equal(outcome.validation.issue, 'amount_mismatch');
    }
  });
});

describe('resolveInitialSplitMode', () => {
  it('returns null when no existing split', () => {
    assert.equal(resolveInitialSplitMode(null), null);
  });

  it('returns null for whole-table custom single row', () => {
    assert.equal(
      resolveInitialSplitMode({
        split_mode: 'custom',
        result: [{ name: 'Total', amount: 50 }],
      } as never),
      null,
    );
  });

  it('returns persisted mode for multi-person custom split', () => {
    assert.equal(
      resolveInitialSplitMode({
        split_mode: 'custom',
        result: [
          { name: 'A', amount: 25 },
          { name: 'B', amount: 25 },
        ],
      } as never),
      'custom',
    );
  });
});
