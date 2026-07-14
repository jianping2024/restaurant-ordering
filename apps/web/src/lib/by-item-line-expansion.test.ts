import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ByItemConsumerRow } from './bill-split-by-item';
import {
  appendByItemConsumerRow,
  getByItemLineStatusFromRows,
  isByItemLineComplete,
} from './bill-split-by-item';
import type { ByItemLineSpec } from './bill-split-by-item-lines';
import {
  defaultExpandedLineKey,
  isByItemLineExpanded,
  seedInitialLineExpansion,
  toggleByItemLineExpansion,
} from './by-item-line-expansion';

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

function menuSpec(key: string, lineQty: number): ByItemLineSpec {
  return {
    mode: 'menu',
    key,
    lineQty,
    lineTotal: lineQty * 2,
    unitPrice: 2,
  };
}

describe('by-item-line-expansion', () => {
  const lineA = menuSpec('line-a', 4);
  const lineB = menuSpec('line-b', 2);
  const lineSpecs = [lineA, lineB];

  it('seeds the first incomplete line on initial render', () => {
    const allocations = {
      'line-a': [row('1', 'Jack', { whole: '2' }), row('2', 'Tom', { whole: '1' })],
      'line-b': [row('3', '', {})],
    };
    const seeded = seedInitialLineExpansion(lineSpecs, allocations, {});
    assert.equal(defaultExpandedLineKey(lineSpecs, allocations), 'line-a');
    assert.equal(isByItemLineExpanded('line-a', seeded), true);
    assert.equal(isByItemLineExpanded('line-b', seeded), false);
  });

  it('does not re-seed after the user toggles expansion', () => {
    const allocations = {
      'line-a': [row('1', 'Jack', { whole: '4' })],
      'line-b': [row('2', '', {})],
    };
    const collapsed = toggleByItemLineExpansion('line-a', { 'line-a': true }, lineSpecs, allocations);
    assert.equal(isByItemLineExpanded('line-a', collapsed), false);

    const reseeded = seedInitialLineExpansion(lineSpecs, allocations, collapsed);
    assert.deepEqual(reseeded, collapsed);
  });

  it('stays expanded when typing the final consumer name completes the line', () => {
    const spec = menuSpec('wine', 4);
    const specs = [spec];
    const rows = [
      row('1', 'Jack', { whole: '2' }),
      row('2', 'Tom', { whole: '1' }),
    ];
    const incomplete = { wine: rows };
    assert.equal(
      isByItemLineComplete(getByItemLineStatusFromRows(incomplete.wine, spec)),
      false,
    );

    const withNewConsumer = { wine: appendByItemConsumerRow(rows, spec) };
    assert.equal(
      isByItemLineComplete(getByItemLineStatusFromRows(withNewConsumer.wine, spec)),
      false,
    );

    const expanded = seedInitialLineExpansion(specs, withNewConsumer, {});
    assert.equal(isByItemLineExpanded('wine', expanded), true);

    const completedRows = withNewConsumer.wine.map((candidate) => (
      candidate.id === withNewConsumer.wine[withNewConsumer.wine.length - 1].id
        ? { ...candidate, name: 'Kate' }
        : candidate
    ));
    const complete = { wine: completedRows };
    assert.equal(
      isByItemLineComplete(getByItemLineStatusFromRows(complete.wine, spec)),
      true,
    );

    const afterComplete = seedInitialLineExpansion(specs, complete, expanded);
    assert.deepEqual(afterComplete, expanded);
    assert.equal(isByItemLineExpanded('wine', afterComplete), true);
  });

  it('opens the next incomplete line when collapsing a completed line', () => {
    const allocations = {
      'line-a': [row('1', 'Jack', { whole: '4' })],
      'line-b': [row('2', '', { whole: '1' })],
    };
    const next = toggleByItemLineExpansion(
      'line-a',
      { 'line-a': true },
      lineSpecs,
      allocations,
    );
    assert.equal(isByItemLineExpanded('line-a', next), false);
    assert.equal(isByItemLineExpanded('line-b', next), true);
  });
});
