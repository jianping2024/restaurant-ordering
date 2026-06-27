import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compareSortOrder,
  compareSortOrderThenCreatedAt,
  nextSortOrder,
  sortBySortOrderThenCreatedAt,
  swapSortOrderFields,
} from './sort-order';

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

describe('swapSortOrderFields', () => {
  it('exchanges sort_order between two rows', () => {
    const a = { sort_order: 1 };
    const b = { sort_order: 4 };
    swapSortOrderFields(a, b);
    assert.equal(a.sort_order, 4);
    assert.equal(b.sort_order, 1);
  });
});

describe('compareSortOrderThenCreatedAt', () => {
  it('uses created_at as tiebreaker', () => {
    const rows = [
      { sort_order: 1, created_at: '2026-01-02' },
      { sort_order: 1, created_at: '2026-01-01' },
    ];
    assert.deepEqual([...rows].sort(compareSortOrderThenCreatedAt), [
      { sort_order: 1, created_at: '2026-01-01' },
      { sort_order: 1, created_at: '2026-01-02' },
    ]);
  });
});

describe('sortBySortOrderThenCreatedAt', () => {
  it('returns a sorted copy', () => {
    const rows = [
      { sort_order: 2, created_at: 'b' },
      { sort_order: 0, created_at: 'a' },
    ];
    assert.deepEqual(sortBySortOrderThenCreatedAt(rows), [
      { sort_order: 0, created_at: 'a' },
      { sort_order: 2, created_at: 'b' },
    ]);
  });
});
