import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { billOrdersFingerprint, isBillOrdersComplete } from './customer-bill-sync';
import { computeSplitResults, validateSplitDraft } from './bill-split-draft';
import type { ByItemConsumerRow } from './bill-split-by-item';
import { resolvePersistedSplitModeForDraft } from './checkout-split-intent';
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

function buffetSpec(key: string, adults: number, children: number): ByItemLineSpec {
  return {
    mode: 'buffet',
    key,
    lineTotal: adults * 15 + children * 8,
    adults,
    children,
    adultUnitPrice: 15,
    childUnitPrice: 8,
  };
}

function consumerRow(
  id: string,
  name: string,
  qtyWhole: string,
  partyId = 'party-a',
): ByItemConsumerRow {
  return {
    id,
    name,
    partyId,
    qtyWhole,
    qtyNum: '',
    qtyDen: '',
    adultQty: '',
    childQty: '',
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
      byItemDraftRows: {},
      parsedByItemAllocations: {},
      lang: 'pt',
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
      byItemDraftRows: {},
      parsedByItemAllocations: {},
      lang: 'pt',
    });
    const high = computeSplitResults({
      splitMode: 'even',
      total: 30,
      orderLines: [menuLine('o1-0', 3, 10)],
      lineSpecs: [menuSpec('o1-0', 3, 10)],
      personCount: 2,
      splitPeople: people,
      customAmounts: [],
      byItemDraftRows: {},
      parsedByItemAllocations: {},
      lang: 'pt',
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
      byItemDraftRows: {},
      parsedByItemAllocations: {
        'o1-0': [{ name: 'Guest 1', qty: { num: 1, den: 1 } }],
      },
      lang: 'pt',
    });
    assert.equal(outcome.validation.ok, false);
    if (!outcome.validation.ok) {
      assert.equal(outcome.validation.issue, 'unassigned_items');
    }
  });

  it('keeps solo custom amount as stored (does not force full bill)', () => {
    const rows = computeSplitResults({
      splitMode: 'custom',
      total: 19.95,
      orderLines: [menuLine('o1-0', 1, 19.95)],
      lineSpecs: [menuSpec('o1-0', 1, 19.95)],
      personCount: 1,
      splitPeople: [{ name: 'Guest 1' }],
      customAmounts: [{ name: 'Guest 1', amount: 10 }],
      byItemDraftRows: {},
      parsedByItemAllocations: {},
      lang: 'pt',
    });
    assert.deepEqual(rows, [{ name: 'Guest 1', amount: 10 }]);
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
      byItemDraftRows: {},
      parsedByItemAllocations: {},
      lang: 'pt',
    });
    assert.equal(outcome.validation.ok, false);
    if (!outcome.validation.ok) {
      assert.equal(outcome.validation.issue, 'amount_mismatch');
    }
  });

  it('rejects a duplicate named draft row even when parsing drops its empty quantity', () => {
    const key = 'o1-0';
    const outcome = validateSplitDraft({
      splitMode: 'by_item',
      total: 10,
      orderLines: [menuLine(key, 1, 10)],
      lineSpecs: [menuSpec(key, 1, 10)],
      personCount: 1,
      splitPeople: [{ name: 'Guest 1' }],
      customAmounts: [],
      byItemDraftRows: {
        [key]: [
          consumerRow('row-1', 'Guest 1', '1'),
          consumerRow('row-2', 'Guest 1', ''),
        ],
      },
      parsedByItemAllocations: {
        [key]: [{ name: 'Guest 1', partyId: 'party-a', qty: { num: 1, den: 1 } }],
      },
      lang: 'pt',
    });

    assert.deepEqual(outcome.validation, { ok: false, issue: 'incomplete_qty' });
  });

  it('rejects duplicate buffet draft rows before serialization can merge them', () => {
    const key = 'buffet-0';
    const first = { ...consumerRow('row-1', 'Guest 1', ''), adultQty: '1' };
    const second = { ...consumerRow('row-2', 'Guest 1', ''), adultQty: '1' };
    const outcome = validateSplitDraft({
      splitMode: 'by_item',
      total: 30,
      orderLines: [],
      lineSpecs: [buffetSpec(key, 2, 0)],
      personCount: 1,
      splitPeople: [{ name: 'Guest 1' }],
      customAmounts: [],
      byItemDraftRows: { [key]: [first, second] },
      parsedByItemAllocations: {
        [key]: [
          { name: 'Guest 1', partyId: 'party-a', guestType: 'adult', qty: { num: 1, den: 1 } },
          { name: 'Guest 1', partyId: 'party-a', guestType: 'adult', qty: { num: 1, den: 1 } },
        ],
      },
      lang: 'pt',
    });

    assert.deepEqual(outcome.validation, { ok: false, issue: 'incomplete_qty' });
  });

  it('allows an unfinished valid pool only for staff partial collection', () => {
    const key = 'o1-0';
    const input = {
      splitMode: 'by_item' as const,
      total: 20,
      orderLines: [menuLine(key, 2, 10)],
      lineSpecs: [menuSpec(key, 2, 10)],
      personCount: 1,
      splitPeople: [{ name: 'Guest 1' }],
      customAmounts: [],
      byItemDraftRows: { [key]: [consumerRow('row-1', 'Guest 1', '1')] },
      parsedByItemAllocations: {
        [key]: [{ name: 'Guest 1', partyId: 'party-a', qty: { num: 1, den: 1 } }],
      },
      lang: 'pt' as const,
    };

    assert.equal(validateSplitDraft(input).validation.ok, false);
    assert.equal(validateSplitDraft(input, { allowPartialByItem: true }).validation.ok, true);
  });

  it('does not relax duplicate rows during staff partial collection', () => {
    const key = 'o1-0';
    const duplicateRows = [
      consumerRow('row-1', 'Guest 1', '1'),
      consumerRow('row-2', 'Guest 1', ''),
    ];
    const outcome = validateSplitDraft({
      splitMode: 'by_item',
      total: 20,
      orderLines: [menuLine(key, 2, 10)],
      lineSpecs: [menuSpec(key, 2, 10)],
      personCount: 1,
      splitPeople: [{ name: 'Guest 1' }],
      customAmounts: [],
      byItemDraftRows: { [key]: duplicateRows },
      parsedByItemAllocations: {
        [key]: [{ name: 'Guest 1', partyId: 'party-a', qty: { num: 1, den: 1 } }],
      },
      lang: 'pt',
    }, { allowPartialByItem: true });

    assert.deepEqual(outcome.validation, { ok: false, issue: 'incomplete_qty' });
  });
});

describe('individual checkout: unnamed rows are unclaimed', () => {
  const key = 'o1-0';
  const baseInput = {
    splitMode: 'by_item' as const,
    total: 20,
    orderLines: [menuLine(key, 2, 10)],
    lineSpecs: [menuSpec(key, 2, 10)],
    personCount: 1,
    splitPeople: [{ name: 'Guest 1' }],
    customAmounts: [],
    parsedByItemAllocations: { [key]: [] },
    lang: 'pt' as const,
  };

  it('ignores a blank seed row so a guest can call with the pool untouched elsewhere', () => {
    const input = {
      ...baseInput,
      byItemDraftRows: { [key]: [consumerRow('row-1', '', '1')] },
    };
    assert.equal(validateSplitDraft(input, { allowPartialByItem: true }).validation.ok, false);
    assert.equal(
      validateSplitDraft(input, { allowPartialByItem: true, ignoreUnnamedRows: true }).validation.ok,
      true,
    );
  });

  it('still rejects a named row with an invalid quantity', () => {
    const outcome = validateSplitDraft(
      {
        ...baseInput,
        byItemDraftRows: { [key]: [consumerRow('row-1', 'Guest 1', '3')] },
        parsedByItemAllocations: {
          [key]: [{ name: 'Guest 1', partyId: 'party-a', qty: { num: 3, den: 1 } }],
        },
      },
      { allowPartialByItem: true, ignoreUnnamedRows: true },
    );
    assert.equal(outcome.validation.ok, false);
  });
});

describe('resolvePersistedSplitModeForDraft', () => {
  it('returns null when no existing split', () => {
    assert.equal(resolvePersistedSplitModeForDraft(null), null);
  });

  it('uses stable whole-table payer key when no split mode selected', () => {
    const rows = computeSplitResults({
      splitMode: null,
      total: 50,
      orderLines: [menuLine('o1-0', 1, 50)],
      lineSpecs: [menuSpec('o1-0', 1, 50)],
      personCount: 2,
      splitPeople: [],
      customAmounts: [],
      parsedByItemAllocations: {},
      lang: 'pt',
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.name, '__whole_table__');
    assert.equal(rows[0]?.amount, 50);
  });

  it('returns null for whole-table persisted split', () => {
    assert.equal(
      resolvePersistedSplitModeForDraft({
        split_mode: 'whole_table',
        result: [{ name: '__whole_table__', amount: 50 }],
      } as never),
      null,
    );
  });

  it('returns null for legacy whole-table custom single row', () => {
    assert.equal(
      resolvePersistedSplitModeForDraft({
        split_mode: 'custom',
        result: [{ name: 'Total', amount: 50 }],
      } as never),
      null,
    );
  });

  it('returns persisted mode for multi-person custom split', () => {
    assert.equal(
      resolvePersistedSplitModeForDraft({
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
