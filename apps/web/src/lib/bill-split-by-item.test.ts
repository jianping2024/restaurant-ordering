import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildByItemAllocationsFromRows,
  byItemLinePriceShare,
  calcByItemSplitResults,
  consumersForLineFromPersons,
  parseConsumerRows,
  shareQtyLabel,
  withDefaultByItemLineRows,
} from './bill-split-by-item';
import { validateBillSplit } from './bill-split-validate';

describe('withDefaultByItemLineRows', () => {
  it('adds one empty row per missing line key', () => {
    const next = withDefaultByItemLineRows({}, ['a', 'b']);
    assert.equal(next.a?.length, 1);
    assert.equal(next.b?.length, 1);
    assert.equal(next.a?.[0]?.name, '');
  });

  it('keeps existing rows and ids', () => {
    const existing = {
      a: [{ id: 'stable-a', name: 'John', qtyInput: '1' }],
    };
    const next = withDefaultByItemLineRows(existing, ['a', 'b']);
    assert.equal(next.a?.[0]?.id, 'stable-a');
    assert.equal(next.b?.length, 1);
    assert.ok(next.b?.[0]?.id.startsWith('row-'));
  });

  it('returns the same object when nothing is missing', () => {
    const existing = {
      a: [{ id: 'stable-a', name: 'John', qtyInput: '1' }],
    };
    assert.equal(withDefaultByItemLineRows(existing, ['a']), existing);
  });
});
describe('calcByItemSplitResults', () => {
  it('allocates five bottles across named consumers with fractional qty', () => {
    const allocations = buildByItemAllocationsFromRows([
      {
        key: 'order-0',
        rows: [
          { id: '1', name: 'tom', qtyInput: '2 1/3' },
          { id: '2', name: 'jerry', qtyInput: '1 1/3' },
          { id: '3', name: 'candy', qtyInput: '1 1/3' },
        ],
      },
    ]);

    const results = calcByItemSplitResults({
      lines: [{ key: 'order-0', name: 'Cola', qty: 5, unitPrice: 2 }],
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
      { id: '1', name: 'Ana', qtyInput: '1' },
      { id: '2', name: '', qtyInput: '2' },
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
      5,
    );
    assert.equal(consumers.length, 1);
    assert.equal(shareQtyLabel(consumers[0]!.qty), '2 1/3');
  });
});

describe('validateBillSplit by_item', () => {
  it('rejects incomplete qty allocation', () => {
    const allocations = buildByItemAllocationsFromRows([
      {
        key: 'order-0',
        rows: [{ id: '1', name: 'tom', qtyInput: '2' }],
      },
    ]);
    const result = validateBillSplit({
      splitMode: 'by_item',
      total: 10,
      results: [{ name: 'tom', amount: 4 }],
      itemLines: [{ key: 'order-0', qty: 5 }],
      byItemAllocations: allocations,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.issue, 'incomplete_qty');
  });

  it('accepts a fully allocated line', () => {
    const allocations = buildByItemAllocationsFromRows([
      {
        key: 'order-0',
        rows: [
          { id: '1', name: 'tom', qtyInput: '2 1/3' },
          { id: '2', name: 'jerry', qtyInput: '1 1/3' },
          { id: '3', name: 'candy', qtyInput: '1 1/3' },
        ],
      },
    ]);
    const results = calcByItemSplitResults({
      lines: [{ key: 'order-0', name: 'Cola', qty: 5, unitPrice: 2 }],
      allocations,
    });
    const result = validateBillSplit({
      splitMode: 'by_item',
      total: 10,
      results,
      itemLines: [{ key: 'order-0', qty: 5 }],
      byItemAllocations: allocations,
    });
    assert.equal(result.ok, true);
  });
});

describe('byItemLinePriceShare', () => {
  it('distributes cents without losing the line total', () => {
    const shares = parseConsumerRows([
      { id: '1', name: 'tom', qtyInput: '2 1/3' },
      { id: '2', name: 'jerry', qtyInput: '1 1/3' },
      { id: '3', name: 'candy', qtyInput: '1 1/3' },
    ]);
    const total = shares.reduce(
      (sum, share) => sum + byItemLinePriceShare(10, shares, share.name),
      0,
    );
    assert.equal(total, 10);
  });
});
