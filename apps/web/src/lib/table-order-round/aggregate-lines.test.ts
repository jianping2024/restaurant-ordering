import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aggregateRoundLinesForAppend } from './aggregate-lines';

describe('aggregateRoundLinesForAppend', () => {
  it('sums qty for the same item and note', () => {
    const rows = aggregateRoundLinesForAppend([
      { menu_item_id: 'a', qty: 2, note: '' },
      { menu_item_id: 'a', qty: 1, note: '' },
    ]);
    assert.deepEqual(rows, [{ menu_item_id: 'a', qty: 3, note: '' }]);
  });

  it('keeps the same item as two kitchen lines when notes differ', () => {
    const rows = aggregateRoundLinesForAppend([
      { menu_item_id: 'a', qty: 1, note: '少辣' },
      { menu_item_id: 'a', qty: 2, note: '' },
    ]);
    assert.deepEqual(rows, [
      { menu_item_id: 'a', qty: 1, note: '少辣' },
      { menu_item_id: 'a', qty: 2, note: '' },
    ]);
  });

  it('trims notes before grouping', () => {
    const rows = aggregateRoundLinesForAppend([
      { menu_item_id: 'a', qty: 1, note: ' 少辣 ' },
      { menu_item_id: 'a', qty: 1, note: '少辣' },
    ]);
    assert.deepEqual(rows, [{ menu_item_id: 'a', qty: 2, note: '少辣' }]);
  });
});
