import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ByItemConsumerRow } from './bill-split-by-item';
import {
  appendByItemConsumerRow,
  buildByItemAllocationsFromRows,
  byItemLinePriceShare,
  byItemLineStatusSummary,
  calcByItemSplitResults,
  consumersForLineFromPersons,
  countByItemAllocationProgress,
  getBuffetLineStatusFromRows,
  getByItemLineStatusFromRows,
  locateByItemSplitResult,
  parseConsumerRows,
  rationalToRowQtyFields,
  removeByItemConsumerRow,
  resolveBuffetRowCounts,
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
  adultQty: string,
  childQty = '',
): ByItemConsumerRow {
  return { ...row(id, name, {}), adultQty, childQty };
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
  buffetShortAdult: '还差 {n}成人',
  buffetShortChild: '还差 {n}儿童',
  buffetOverAdult: '超出 {n}成人',
  buffetOverChild: '超出 {n}儿童',
  buffetAdultProgress: '成人 {allocated}/{total}',
  buffetChildProgress: '儿童 {allocated}/{total}',
};

describe('validateQtyParts', () => {
  it('composes whole and fraction without symbols', () => {
    const mixed = validateQtyParts({ whole: '2', num: '1', den: '3' });
    assert.equal(mixed.ok, true);
    if (mixed.ok) assert.equal(shareQtyLabel(mixed.qty), '2 1/3');
  });
});

describe('withDefaultByItemLineRows', () => {
  it('seeds buffet rows with default adult qty 1', () => {
    const next = withDefaultByItemLineRows({}, [buffetSpec('buffet-0', 2, 0)]);
    assert.equal(next['buffet-0']?.[0]?.adultQty, '1');
  });

  it('seeds menu rows with default whole qty 1', () => {
    const next = withDefaultByItemLineRows({}, [menuSpec('water', 1)]);
    assert.equal(next['water']?.[0]?.qtyWhole, '1');
  });
});

describe('appendByItemConsumerRow', () => {
  it('prefills menu remainder after a named partial share', () => {
    const spec = menuSpec('wine', 1);
    const rows = [row('1', 'Cindy', { num: '1', den: '3' })];
    const next = appendByItemConsumerRow(rows, spec);
    assert.equal(next.length, 2);
    assert.equal(next[1]?.qtyNum, '2');
    assert.equal(next[1]?.qtyDen, '3');
    assert.equal(next[1]?.name, '');
  });

  it('prefills integer menu remainder for multi-qty lines', () => {
    const spec = menuSpec('beer', 3);
    const rows = [row('1', 'John', { whole: '1' })];
    const next = appendByItemConsumerRow(rows, spec);
    assert.equal(next[1]?.qtyWhole, '2');
  });

  it('subtracts cumulative named menu shares', () => {
    const spec = menuSpec('beer', 3);
    const rows = [
      row('1', 'John', { whole: '1' }),
      row('2', 'Mary', { whole: '1' }),
    ];
    const next = appendByItemConsumerRow(rows, spec);
    assert.equal(next[2]?.qtyWhole, '1');
  });

  it('ignores unnamed rows when computing menu remainder', () => {
    const spec = menuSpec('wine', 1);
    const rows = [
      row('1', 'Cindy', { num: '1', den: '3' }),
      row('2', '', { num: '1', den: '3' }),
    ];
    const next = appendByItemConsumerRow(rows, spec);
    assert.equal(next.length, 3);
    assert.equal(next[2]?.qtyNum, '2');
    assert.equal(next[2]?.qtyDen, '3');
  });

  it('prefills buffet adult and child remainders', () => {
    const spec = buffetSpec('buffet-0', 3, 2);
    const rows = [buffetRow('1', 'Cindy', '1', '1')];
    const next = appendByItemConsumerRow(rows, spec);
    assert.equal(next[1]?.adultQty, '2');
    assert.equal(next[1]?.childQty, '1');
  });

  it('marks a line complete after sequential buffet fills', () => {
    const spec = buffetSpec('buffet-0', 3, 2);
    const rows = appendByItemConsumerRow(
      [buffetRow('1', 'Cindy', '1', '1')],
      spec,
    );
    rows[1] = { ...rows[1]!, name: 'John' };
    const status = getBuffetLineStatusFromRows(rows, spec);
    assert.equal(status.kind, 'complete');
  });

  it('adds an empty row when the line is already fully allocated', () => {
    const spec = menuSpec('wine', 1);
    const rows = [row('1', 'Cindy', { whole: '1' })];
    const next = appendByItemConsumerRow(rows, spec);
    assert.equal(next[1]?.qtyWhole, '');
    assert.equal(next[1]?.qtyNum, '');
    assert.equal(next[1]?.qtyDen, '');
  });

  it('formats rational remainders consistently with hydration', () => {
    const fields = rationalToRowQtyFields({ num: 2, den: 3 });
    assert.deepEqual(fields, { qtyWhole: '', qtyNum: '2', qtyDen: '3' });
  });
});

describe('buffet by-item', () => {
  it('defaults name-only row to 1 adult', () => {
    const counts = resolveBuffetRowCounts(buffetRow('1', 'John', '', ''));
    assert.deepEqual(counts, { adults: 1, children: 0 });
  });

  it('lets one payer cover multiple adult and child heads', () => {
    const spec = buffetSpec('buffet-0', 2, 1);
    const status = getBuffetLineStatusFromRows([buffetRow('1', 'John', '2', '1')], spec);
    assert.equal(status.kind, 'complete');
    if (status.kind === 'complete') {
      assert.equal(
        byItemLineStatusSummary(status, statusLabels, undefined, { buffet: true }).text,
        '已分完 · 成人 2/2 · 儿童 1/1',
      );
    }
  });

  it('prices buffet by headcount per payer', () => {
    const spec = buffetSpec('buffet-0', 2, 1);
    const allocations = buildByItemAllocationsFromRows([spec], {
      'buffet-0': [buffetRow('1', 'John', '2', '1')],
    });
    const results = calcByItemSplitResults({
      lines: [{
        key: 'buffet-0',
        name: 'Lunch Buffet',
        mode: 'buffet',
        adults: 2,
        children: 1,
        adultUnitPrice: 15,
        childUnitPrice: 8,
      }],
      allocations,
    });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.name, 'John');
    assert.equal(results[0]?.amount, 38);
  });

  it('includes incomplete line shares priced unit×qty for mid-split collect', () => {
    const menu = menuSpec('oj', 2);
    const buffet = buffetSpec('buffet-0', 2, 0);
    const allocations = buildByItemAllocationsFromRows([menu, buffet], {
      oj: [row('1', 'John', { whole: '1' })],
      'buffet-0': [buffetRow('2', 'John', '1', '')],
    });
    const results = calcByItemSplitResults({
      lines: [
        { key: 'oj', name: 'OJ', mode: 'menu', qty: 2, unitPrice: 3.5 },
        {
          key: 'buffet-0',
          name: 'Buffet',
          mode: 'buffet',
          adults: 2,
          children: 0,
          adultUnitPrice: 28.15,
          childUnitPrice: 0,
        },
      ],
      allocations,
    });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.name, 'John');
    assert.equal(results[0]?.amount, 3.5 + 28.15);
    const located = locateByItemSplitResult(results, 'John');
    assert.equal(located?.index, 0);
    assert.equal(located?.row.amount, 31.65);
  });

  it('shows short status with progress counts', () => {
    const partial = getBuffetLineStatusFromRows([buffetRow('1', 'John', '1', '')], { adults: 2, children: 0 });
    assert.equal(partial.kind, 'buffet_short');
    assert.equal(
      byItemLineStatusSummary(partial, statusLabels, undefined, { buffet: true }).text,
      '还差 1成人 · 成人 1/2',
    );
  });
});

describe('getByItemLineStatus', () => {
  it('marks a fully allocated menu line complete', () => {
    const spec = menuSpec('line', 3.5);
    const status = getByItemLineStatusFromRows(
      [row('1', 'John', { num: '1', den: '2' }), row('2', 'Jimmy', { whole: '3' })],
      spec,
    );
    assert.equal(status.kind, 'complete');
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

describe('consumersForLineFromPersons', () => {
  it('reads buffet shares with qty greater than 1', () => {
    const consumers = consumersForLineFromPersons(
      [{
        name: 'John',
        item_shares: [
          { key: 'buffet-0', qty_num: 2, qty_den: 1, guest_type: 'adult' },
          { key: 'buffet-0', qty_num: 1, qty_den: 1, guest_type: 'child' },
        ],
      }],
      'buffet-0',
      buffetSpec('buffet-0', 2, 1),
    );
    assert.equal(consumers.length, 2);
    assert.equal(shareQtyLabel(consumers[0]!.qty), '2');
    assert.equal(consumers[0]?.guestType, 'adult');
  });
});

describe('validateBillSplit by_item', () => {
  it('accepts buffet line fully assigned to one payer', () => {
    const spec = buffetSpec('buffet-0', 2, 1);
    const allocations = buildByItemAllocationsFromRows([spec], {
      'buffet-0': [buffetRow('1', 'John', '2', '1')],
    });
    const results = calcByItemSplitResults({
      lines: [{ key: 'buffet-0', name: 'Buffet', mode: 'buffet', adults: 2, children: 1, adultUnitPrice: 15, childUnitPrice: 8 }],
      allocations,
    });
    const result = validateBillSplit({
      splitMode: 'by_item',
      total: 38,
      results,
      lineSpecs: [spec],
      byItemAllocations: allocations,
    });
    assert.equal(result.ok, true);
  });
});

describe('removeByItemConsumerRow', () => {
  it('drops the target row when multiple rows exist', () => {
    const rows = [row('a', 'John', {}), row('b', 'Mary', {})];
    const next = removeByItemConsumerRow(rows, 'a');
    assert.equal(next.length, 1);
    assert.equal(next[0]?.name, 'Mary');
  });

  it('keeps one empty row when removing the last remaining row', () => {
    const rows = [row('a', 'John', { whole: '1' })];
    const next = removeByItemConsumerRow(rows, 'a');
    assert.equal(next.length, 1);
    assert.notEqual(next[0]?.id, 'a');
    assert.equal(next[0]?.name, '');
    assert.equal(next[0]?.qtyWhole, '1');
  });

  it('creates a buffet default row when the last buffet row is removed', () => {
    const rows = [{ ...row('a', 'John', {}), adultQty: '2', childQty: '' }];
    const next = removeByItemConsumerRow(rows, 'a', { buffet: true });
    assert.equal(next.length, 1);
    assert.equal(next[0]?.adultQty, '1');
    assert.equal(next[0]?.childQty, '');
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

  it('weights whole vs half by real qty (not equal nums)', () => {
    const shares = [
      { name: '客人 10', qty: { num: 1, den: 1 } },
      { name: '客人 11', qty: { num: 1, den: 2 } },
      { name: '客人 12', qty: { num: 1, den: 2 } },
    ];
    assert.deepEqual(
      shares.map((share) => byItemLinePriceShare(4.4, shares, share.name)),
      [2.2, 1.1, 1.1],
    );
  });
});

describe('calcByItemSplitResults cent remainder', () => {
  it('prices whole+half+half cola as 2.20+1.10+1.10', () => {
    const results = calcByItemSplitResults({
      lines: [{ key: 'cola', name: 'Cola', mode: 'menu', qty: 2, unitPrice: 2.2 }],
      allocations: {
        cola: [
          { name: '客人 10', qty: { num: 1, den: 1 } },
          { name: '客人 11', qty: { num: 1, den: 2 } },
          { name: '客人 12', qty: { num: 1, den: 2 } },
        ],
      },
    });
    assert.deepEqual(
      results.map((row) => ({ name: row.name, amount: row.amount })),
      [
        { name: '客人 10', amount: 2.2 },
        { name: '客人 11', amount: 1.1 },
        { name: '客人 12', amount: 1.1 },
      ],
    );
  });

  it('keeps 1.85×(1.5+1.5+1) water line at €7.40 not €7.41', () => {
    const results = calcByItemSplitResults({
      lines: [{ key: 'water', name: 'Water', mode: 'menu', qty: 4, unitPrice: 1.85 }],
      allocations: {
        water: [
          { name: '客人 9', qty: { num: 3, den: 2 } },
          { name: '客人 10', qty: { num: 3, den: 2 } },
          { name: '客人 11', qty: { num: 1, den: 1 } },
        ],
      },
    });
    assert.deepEqual(
      results.map((row) => ({ name: row.name, amount: row.amount })),
      [
        { name: '客人 9', amount: 2.77 },
        { name: '客人 10', amount: 2.78 },
        { name: '客人 11', amount: 1.85 },
      ],
    );
  });
});
