import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareSortOrder, nextSortOrder } from './sort-order';

describe('nextSortOrder', () => {
  it('returns 0 for an empty scope', () => {
    assert.equal(nextSortOrder([]), 0);
  });

  it('returns max + 1 for contiguous zero-based orders', () => {
    assert.equal(
      nextSortOrder([{ sort_order: 0 }, { sort_order: 1 }, { sort_order: 2 }]),
      3,
    );
  });

  it('returns max + 1 when gaps exist after deletions', () => {
    assert.equal(
      nextSortOrder([{ sort_order: 0 }, { sort_order: 1 }, { sort_order: 4 }]),
      5,
    );
  });

  it('returns max + 1 when legacy data starts at 1', () => {
    assert.equal(
      nextSortOrder([{ sort_order: 1 }, { sort_order: 2 }, { sort_order: 3 }]),
      4,
    );
  });
});

describe('compareSortOrder', () => {
  it('sorts ascending by sort_order', () => {
    const rows = [{ sort_order: 3 }, { sort_order: 0 }, { sort_order: 2 }];
    assert.deepEqual([...rows].sort(compareSortOrder), [
      { sort_order: 0 },
      { sort_order: 2 },
      { sort_order: 3 },
    ]);
  });
});
