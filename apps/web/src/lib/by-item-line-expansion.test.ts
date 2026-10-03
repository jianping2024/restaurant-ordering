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
  findFirstIncompleteLineKey,
  isByItemExpansionHoldTarget,
  isByItemLineExpanded,
  reconcileByItemExpandedLineKey,
  byItemConsumerNameInputSelector,
  shouldFocusFirstByItemConsumerNameOnExpand,
  toggleByItemExpandedLineKey,
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

function buffetRow(
  id: string,
  name: string,
  adults: string,
  children = '0',
): ByItemConsumerRow {
  return {
    id,
    name,
    qtyWhole: '',
    qtyNum: '',
    qtyDen: '',
    adultQty: adults,
    childQty: children,
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

function buffetSpec(key: string): ByItemLineSpec {
  return {
    mode: 'buffet',
    key,
    lineTotal: 30,
    adults: 2,
    children: 0,
    adultUnitPrice: 15,
    childUnitPrice: 0,
  };
}

describe('by-item-line-expansion', () => {
  const headcount = buffetSpec('buffet-headcount');
  const lineA = menuSpec('line-a', 4);
  const lineB = menuSpec('line-b', 2);
  const lineSpecs = [headcount, lineA, lineB];

  it('seeds the first incomplete line (skips completed headcount)', () => {
    const allocations = {
      'buffet-headcount': [buffetRow('h1', 'Jack', '2')],
      'line-a': [row('1', 'Jack', { whole: '2' }), row('2', 'Tom', { whole: '1' })],
      'line-b': [row('3', '', {})],
    };
    assert.equal(
      isByItemLineComplete(
        getByItemLineStatusFromRows(allocations['buffet-headcount'], headcount),
      ),
      true,
    );
    assert.equal(findFirstIncompleteLineKey(lineSpecs, allocations), 'line-a');
    const seeded = reconcileByItemExpandedLineKey(lineSpecs, allocations, undefined);
    assert.equal(seeded, 'line-a');
    assert.equal(isByItemLineExpanded('buffet-headcount', seeded), false);
    assert.equal(isByItemLineExpanded('line-a', seeded), true);
  });

  it('advances off a completed line when allocations update', () => {
    const incomplete = {
      'buffet-headcount': [buffetRow('h1', 'Jack', '2')],
      'line-a': [row('1', 'Jack', { whole: '2' }), row('2', 'Tom', { whole: '1' })],
      'line-b': [row('3', '', {})],
    };
    const onA = reconcileByItemExpandedLineKey(lineSpecs, incomplete, undefined);
    assert.equal(onA, 'line-a');

    const completeA = {
      ...incomplete,
      'line-a': [row('1', 'Jack', { whole: '4' })],
    };
    const advanced = reconcileByItemExpandedLineKey(lineSpecs, completeA, onA);
    assert.equal(advanced, 'line-b');
    assert.equal(isByItemLineExpanded('line-a', advanced), false);
  });

  it('keeps a manually opened incomplete line that is not first', () => {
    const allocations = {
      'buffet-headcount': [buffetRow('h1', '', '')],
      'line-a': [row('1', '', {})],
      'line-b': [row('2', '', {})],
    };
    const openedB = toggleByItemExpandedLineKey('line-b', null, lineSpecs, allocations);
    assert.equal(openedB, 'line-b');
    const kept = reconcileByItemExpandedLineKey(lineSpecs, allocations, openedB);
    assert.equal(kept, 'line-b');
  });

  it('keeps null after the user collapses an incomplete line', () => {
    const allocations = {
      'buffet-headcount': [buffetRow('h1', '', '')],
      'line-a': [row('1', '', {})],
      'line-b': [row('2', '', {})],
    };
    const collapsed = toggleByItemExpandedLineKey('line-a', 'line-a', lineSpecs, allocations);
    assert.equal(collapsed, null);
    assert.equal(reconcileByItemExpandedLineKey(lineSpecs, allocations, collapsed), null);
  });

  it('opens nothing when every line is complete', () => {
    const allocations = {
      'buffet-headcount': [buffetRow('h1', 'Jack', '2')],
      'line-a': [row('1', 'Jack', { whole: '4' })],
      'line-b': [row('2', 'Tom', { whole: '2' })],
    };
    assert.equal(reconcileByItemExpandedLineKey(lineSpecs, allocations, undefined), null);
    assert.equal(reconcileByItemExpandedLineKey(lineSpecs, allocations, 'line-a'), null);
  });

  it('advances when collapsing a completed line', () => {
    const allocations = {
      'buffet-headcount': [buffetRow('h1', 'Jack', '2')],
      'line-a': [row('1', 'Jack', { whole: '4' })],
      'line-b': [row('2', '', { whole: '1' })],
    };
    const next = toggleByItemExpandedLineKey('line-a', 'line-a', lineSpecs, allocations);
    assert.equal(next, 'line-b');
  });

  it('advances when the open incomplete line becomes complete via last consumer name', () => {
    const spec = menuSpec('wine', 4);
    const specs = [spec];
    const rows = [
      row('1', 'Jack', { whole: '2' }),
      row('2', 'Tom', { whole: '1' }),
    ];
    const withNewConsumer = { wine: appendByItemConsumerRow(rows, spec) };
    const open = reconcileByItemExpandedLineKey(specs, withNewConsumer, undefined);
    assert.equal(open, 'wine');

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
    assert.equal(reconcileByItemExpandedLineKey(specs, complete, open), null);
  });

  it('holds the open completed line while editing; advances after hold clears', () => {
    const buffet: ByItemLineSpec = {
      mode: 'buffet',
      key: 'buffet-headcount',
      lineTotal: 15,
      adults: 1,
      children: 0,
      adultUnitPrice: 15,
      childUnitPrice: 0,
    };
    const wine = menuSpec('wine', 1);
    const specs = [buffet, wine];
    const incomplete = {
      'buffet-headcount': [buffetRow('h1', '', '1')],
      wine: [row('w1', '', { whole: '1' })],
    };
    const open = reconcileByItemExpandedLineKey(specs, incomplete, undefined);
    assert.equal(open, 'buffet-headcount');

    const named = {
      ...incomplete,
      'buffet-headcount': [buffetRow('h1', 'A', '1')],
    };
    assert.equal(
      isByItemLineComplete(
        getByItemLineStatusFromRows(named['buffet-headcount'], buffet),
      ),
      true,
    );
    assert.equal(
      reconcileByItemExpandedLineKey(specs, named, open, { holdWhileEditing: true }),
      'buffet-headcount',
    );
    assert.equal(
      reconcileByItemExpandedLineKey(specs, named, open, { holdWhileEditing: false }),
      'wine',
    );
  });

  it('isByItemExpansionHoldTarget rejects null / missing expanded key', () => {
    assert.equal(isByItemExpansionHoldTarget(null, 'buffet-headcount'), false);
    assert.equal(isByItemExpansionHoldTarget(undefined, 'buffet-headcount'), false);
    assert.equal(isByItemExpansionHoldTarget({} as EventTarget, null), false);
  });

  it('focuses next name only on string→string expand advance', () => {
    assert.equal(
      shouldFocusFirstByItemConsumerNameOnExpand(undefined, 'buffet-headcount'),
      false,
    );
    assert.equal(shouldFocusFirstByItemConsumerNameOnExpand(null, 'wine'), false);
    assert.equal(shouldFocusFirstByItemConsumerNameOnExpand('buffet-headcount', null), false);
    assert.equal(
      shouldFocusFirstByItemConsumerNameOnExpand('buffet-headcount', 'buffet-headcount'),
      false,
    );
    assert.equal(
      shouldFocusFirstByItemConsumerNameOnExpand('buffet-headcount', 'wine'),
      true,
    );
  });
});

describe('byItemConsumerNameInputSelector', () => {
  it('targets the first name without a row id (auto-advance)', () => {
    assert.equal(byItemConsumerNameInputSelector(), 'input[role="combobox"]');
  });

  it('targets the just-added row by id', () => {
    assert.equal(
      byItemConsumerNameInputSelector('row-abc123'),
      '[data-by-item-row-id="row-abc123"] input[role="combobox"]',
    );
  });

  it('escapes quotes in the row id', () => {
    assert.equal(
      byItemConsumerNameInputSelector('a"b'),
      '[data-by-item-row-id="a\\"b"] input[role="combobox"]',
    );
  });
});
