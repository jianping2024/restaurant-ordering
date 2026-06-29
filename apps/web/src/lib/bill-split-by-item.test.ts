import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ByItemConsumerRow } from './bill-split-by-item';
import {
  buildByItemAllocationsFromRows,
  byItemLinePriceShare,
  byItemLineStatusSummary,
  calcByItemSplitResults,
  consumersForLineFromPersons,
  countByItemAllocationProgress,
  getBuffetLineStatusFromRows,
  getByItemLineStatusFromRows,
  getByItemLineStatusFromShares,
  isByItemLineComplete,
  parseConsumerRows,
  shareQtyLabel,
  validateQtyParts,
  withDefaultByItemLineRows,
} from './bill-split-by-item';
import type { ByItemLineSpec } from './bill-split-by-item-lines';
import { validateBillSplit } from './bill-split-validate';

function row(
  id: string,
  name: string,
  qty: { whole?: string; num?: string; den?: string },
): ByItemConsumerRow {
  return {
    id,
    name,
    qtyWhole: qty.whole ?? '',
    qtyNum: qty.num ?? '',
    qtyDen: qty.den ?? '',
  };
}

function buffetRow(
  id: string,
  name: string,
  guestType: 'adult' | 'child' | '',
): ByItemConsumerRow {
  return { ...row(id, name, {}), guestType };
}

function menuSpec(key: string, lineQty: number, unitPrice = 2): ByItemLineSpec {
  return {
    mode: 'menu',
    key,
    lineQty,
    lineTotal: lineQty * unitPrice,
    unitPrice,
  };
}

function buffetSpec(
  key: string,
  adults: number,
  children: number,
  adultUnitPrice = 15,
  childUnitPrice = 8,
): ByItemLineSpec {
  return {
    mode: 'buffet',
    key,
    lineTotal: adults * adultUnitPrice + children * childUnitPrice,
    adults,
    children,
    adultUnitPrice,
    childUnitPrice,
  };
}

const statusLabels = {
  complete: '已分完 · {qty}',
  remaining: '还差 {qty} · 已分 {allocated}',
  over: '超出 {qty} · 已分 {allocated}',
  missingNames: '请填写姓名',
  duplicateNames: '不能重复',
  unassigned: '还差 {qty}',
  invalidQty: '数量有误',
  buffetComplete: '已分完',
  buffetShortAdult: '还差 {n}大人',
  buffetShortChild: '还差 {n}小孩',
  buffetOverAdult: '超出 {n}大人',
  buffetOverChild: '超出 {n}小孩',
  buffetMissingGuestType: '请选择大人或小孩',
};

const qtyLabels = {
  wholePlaceholder: '整',
  numPlaceholder: '分',
  denPlaceholder: '母',
  missingDen: '请填写完整分数',
  zeroDen: '分母不能为 0',
  improperFraction: '分数须小于 1',
};

describe('validateQtyParts', () => {
  it('composes whole and fraction without symbols', () => {
    const mixed = validateQtyParts({ whole: '2', num: '1', den: '3' });
    assert.equal(mixed.ok, true);
    if (mixed.ok) assert.equal(shareQtyLabel(mixed.qty), '2 1/3');

    const frac = validateQtyParts({ whole: '', num: '1', den: '2' });
    assert.equal(frac.ok, true);
    if (frac.ok) assert.equal(shareQtyLabel(frac.qty), '1/2');
  });

  it('rejects improper fractions and zero denominator', () => {
    assert.equal(validateQtyParts({ whole: '', num: '2', den: '2' }).ok, false);
    assert.equal(validateQtyParts({ whole: '', num: '1', den: '0' }).ok, false);
    assert.equal(validateQtyParts({ whole: '', num: '1', den: '' }).ok, false);
  });
});

describe('withDefaultByItemLineRows', () => {
  it('adds one empty row per missing line key', () => {
    const next = withDefaultByItemLineRows({}, [menuSpec('a', 1), menuSpec('b', 1)]);
    assert.equal(next.a?.length, 1);
    assert.equal(next.b?.length, 1);
    assert.equal(next.a?.[0]?.name, '');
  });

  it('seeds buffet rows with guest type field', () => {
    const next = withDefaultByItemLineRows({}, [buffetSpec('buffet-0', 2, 0)]);
    assert.equal(next['buffet-0']?.[0]?.guestType, '');
  });

  it('keeps existing rows and ids', () => {
    const existing = {
      a: [row('stable-a', 'John', { whole: '1' })],
    };
    const next = withDefaultByItemLineRows(existing, [menuSpec('a', 1), menuSpec('b', 1)]);
    assert.equal(next.a?.[0]?.id, 'stable-a');
    assert.equal(next.b?.length, 1);
    assert.ok(next.b?.[0]?.id.startsWith('row-'));
  });

  it('returns the same object when nothing is missing', () => {
    const existing = {
      a: [row('stable-a', 'John', { whole: '1' })],
    };
    assert.equal(withDefaultByItemLineRows(existing, [menuSpec('a', 1)]), existing);
  });
});

describe('getByItemLineStatus', () => {
  it('marks a fully allocated line complete', () => {
    const spec = menuSpec('line', 3.5);
    const status = getByItemLineStatusFromRows(
      [
        row('1', 'John', { num: '1', den: '2' }),
        row('2', 'Jimmy', { whole: '3' }),
      ],
      spec,
    );
    assert.equal(status.kind, 'complete');
    assert.equal(byItemLineStatusSummary(status, statusLabels, qtyLabels).tone, 'success');
    assert.equal(byItemLineStatusSummary(status, statusLabels, qtyLabels).text, '已分完 · 3 1/2');
  });

  it('uses alert tone for short and over states', () => {
    const short = getByItemLineStatusFromRows([row('1', 'John', { num: '1', den: '2' })], menuSpec('line', 2));
    assert.equal(short.kind, 'short');
    assert.equal(byItemLineStatusSummary(short, statusLabels, qtyLabels).tone, 'alert');

    const over = getByItemLineStatusFromRows([row('1', 'John', { whole: '4' })], menuSpec('line', 3));
    assert.equal(over.kind, 'over');
    assert.equal(byItemLineStatusSummary(over, statusLabels, qtyLabels).tone, 'alert');
    assert.match(byItemLineStatusSummary(over, statusLabels, qtyLabels).text, /^超出 /);
  });

  it('flags duplicate names and invalid qty', () => {
    const dup = getByItemLineStatusFromRows(
      [row('1', 'John', { whole: '1' }), row('2', 'john', { whole: '1' })],
      menuSpec('line', 3),
    );
    assert.equal(dup.kind, 'duplicate_names');

    const invalid = getByItemLineStatusFromRows([row('1', 'John', { num: '2', den: '2' })], menuSpec('line', 1));
    assert.equal(invalid.kind, 'invalid_qty');
  });

  it('shares the same complete rule as checkout validation', () => {
    const spec = menuSpec('order-0', 5);
    const rows = [
      row('1', 'tom', { whole: '2', num: '1', den: '3' }),
      row('2', 'jerry', { whole: '1', num: '1', den: '3' }),
      row('3', 'candy', { whole: '1', num: '1', den: '3' }),
    ];
    const allocations = buildByItemAllocationsFromRows([spec], { 'order-0': rows });
    const shares = allocations['order-0'] ?? [];
    assert.equal(isByItemLineComplete(getByItemLineStatusFromShares(spec, shares)), true);
    assert.equal(isByItemLineComplete(getByItemLineStatusFromRows(rows, spec)), true);
  });
});

describe('buffet by-item status', () => {
  it('requires two adult heads for a 2-adult buffet line', () => {
    const spec = buffetSpec('buffet-0', 2, 0);
    const empty = getBuffetLineStatusFromRows([buffetRow('1', '', '')], spec);
    assert.equal(empty.kind, 'buffet_empty');

    const one = getBuffetLineStatusFromRows([buffetRow('1', 'John', 'adult')], spec);
    assert.equal(one.kind, 'buffet_short');
    if (one.kind === 'buffet_short') assert.equal(one.adultsRemaining, 1);

    const complete = getBuffetLineStatusFromRows(
      [buffetRow('1', 'John', 'adult'), buffetRow('2', 'Mary', 'adult')],
      spec,
    );
    assert.equal(complete.kind, 'complete');
    assert.equal(
      byItemLineStatusSummary(complete, statusLabels, undefined, { buffet: true }).text,
      '已分完',
    );
  });

  it('prices buffet splits by guest type unit price', () => {
    const spec = buffetSpec('buffet-0', 1, 1);
    const allocations = buildByItemAllocationsFromRows([spec], {
      'buffet-0': [
        buffetRow('1', 'John', 'adult'),
        buffetRow('2', 'Kid', 'child'),
      ],
    });
    const results = calcByItemSplitResults({
      lines: [{
        key: 'buffet-0',
        name: 'Lunch Buffet',
        mode: 'buffet',
        adults: 1,
        children: 1,
        adultUnitPrice: 15,
        childUnitPrice: 8,
      }],
      allocations,
    });
    assert.equal(results.find((row) => row.name === 'John')?.amount, 15);
    assert.equal(results.find((row) => row.name === 'Kid')?.amount, 8);
  });
});

describe('countByItemAllocationProgress', () => {
  it('counts only complete lines', () => {
    const progress = countByItemAllocationProgress(
      [menuSpec('a', 1), menuSpec('b', 2)],
      {
        a: [row('1', 'John', { whole: '1' })],
        b: [row('2', 'Mary', { whole: '1' })],
      },
    );
    assert.deepEqual(progress, { complete: 1, total: 2 });
  });
});

describe('calcByItemSplitResults', () => {
  it('allocates five bottles across named consumers with fractional qty', () => {
    const spec = menuSpec('order-0', 5);
    const allocations = buildByItemAllocationsFromRows([spec], {
      'order-0': [
        row('1', 'tom', { whole: '2', num: '1', den: '3' }),
        row('2', 'jerry', { whole: '1', num: '1', den: '3' }),
        row('3', 'candy', { whole: '1', num: '1', den: '3' }),
      ],
    });

    const results = calcByItemSplitResults({
      lines: [{ key: 'order-0', name: 'Cola', mode: 'menu', qty: 5, unitPrice: 2 }],
      allocations,
    });

    assert.equal(results.length, 3);
    const total = results.reduce((sum, row) => sum + row.amount, 0);
    assert.equal(total, 10);
    assert.ok(results.every((row) => row.amount > 0));
  });
});

describe('parseConsumerRows', () => {
  it('ignores blank rows', () => {
    const parsed = parseConsumerRows([
      row('1', 'Ana', { whole: '1' }),
      row('2', '', { whole: '2' }),
    ]);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]?.name, 'Ana');
  });
});

describe('shareQtyLabel', () => {
  it('shows the consumer share label', () => {
    assert.equal(shareQtyLabel({ num: 7, den: 3 }), '2 1/3');
  });
});

describe('consumersForLineFromPersons', () => {
  it('reads explicit item_shares from persisted persons', () => {
    const consumers = consumersForLineFromPersons(
      [
        {
          name: 'tom',
          item_shares: [{ key: 'order-0', qty_num: 7, qty_den: 3 }],
        },
      ],
      'order-0',
      menuSpec('order-0', 5),
    );
    assert.equal(consumers.length, 1);
    assert.equal(shareQtyLabel(consumers[0]!.qty), '2 1/3');
  });

  it('reads buffet guest_type shares as one head each', () => {
    const consumers = consumersForLineFromPersons(
      [
        {
          name: 'John',
          item_shares: [{ key: 'buffet-0', qty_num: 1, qty_den: 1, guest_type: 'adult' }],
        },
      ],
      'buffet-0',
      buffetSpec('buffet-0', 1, 0),
    );
    assert.equal(consumers[0]?.guestType, 'adult');
    assert.equal(shareQtyLabel(consumers[0]!.qty), '1');
  });
});

describe('validateBillSplit by_item', () => {
  it('rejects incomplete qty allocation', () => {
    const spec = menuSpec('order-0', 5);
    const allocations = buildByItemAllocationsFromRows([spec], {
      'order-0': [row('1', 'tom', { whole: '2' })],
    });
    const result = validateBillSplit({
      splitMode: 'by_item',
      total: 10,
      results: [{ name: 'tom', amount: 4 }],
      lineSpecs: [spec],
      byItemAllocations: allocations,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.issue, 'incomplete_qty');
  });

  it('accepts a fully allocated line', () => {
    const spec = menuSpec('order-0', 5);
    const allocations = buildByItemAllocationsFromRows([spec], {
      'order-0': [
        row('1', 'tom', { whole: '2', num: '1', den: '3' }),
        row('2', 'jerry', { whole: '1', num: '1', den: '3' }),
        row('3', 'candy', { whole: '1', num: '1', den: '3' }),
      ],
    });
    const results = calcByItemSplitResults({
      lines: [{ key: 'order-0', name: 'Cola', mode: 'menu', qty: 5, unitPrice: 2 }],
      allocations,
    });
    const result = validateBillSplit({
      splitMode: 'by_item',
      total: 10,
      results,
      lineSpecs: [spec],
      byItemAllocations: allocations,
    });
    assert.equal(result.ok, true);
  });
});

describe('byItemLinePriceShare', () => {
  it('distributes cents without losing the line total', () => {
    const shares = parseConsumerRows([
      row('1', 'tom', { whole: '2', num: '1', den: '3' }),
      row('2', 'jerry', { whole: '1', num: '1', den: '3' }),
      row('3', 'candy', { whole: '1', num: '1', den: '3' }),
    ]);
    const total = shares.reduce(
      (sum, share) => sum + byItemLinePriceShare(10, shares, share.name),
      0,
    );
    assert.equal(total, 10);
  });
});
