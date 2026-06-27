import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adjacentMoveNeighborIndex,
  adjacentSortOrdersAfterMove,
  applyAdjacentSortOrderMove,
  compareSortOrder,
  nextSortOrder,
  sortBySortOrderThenCreatedAt,
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

describe('adjacentSortOrdersAfterMove', () => {
  it('swaps distinct sort orders', () => {
    assert.deepEqual(adjacentSortOrdersAfterMove({ sort_order: 2 }, { sort_order: 5 }, -1), {
      sortOrderA: 5,
      sortOrderB: 2,
    });
  });

  it('moves up when sort orders are equal', () => {
    assert.deepEqual(adjacentSortOrdersAfterMove({ sort_order: 0 }, { sort_order: 0 }, -1), {
      sortOrderA: -1,
      sortOrderB: 0,
    });
  });

  it('moves down when sort orders are equal', () => {
    assert.deepEqual(adjacentSortOrdersAfterMove({ sort_order: 0 }, { sort_order: 0 }, 1), {
      sortOrderA: 1,
      sortOrderB: 0,
    });
  });
});

describe('applyAdjacentSortOrderMove', () => {
  it('updates only the moved pair', () => {
    const rows = [
      { id: 'a', sort_order: 0 },
      { id: 'b', sort_order: 0 },
      { id: 'c', sort_order: 2 },
    ];
    const next = applyAdjacentSortOrderMove(rows, 'b', 'a', -1);
    assert.deepEqual(
      next.map((row) => [row.id, row.sort_order]),
      [
        ['a', 0],
        ['b', -1],
        ['c', 2],
      ],
    );
  });
});

describe('sortBySortOrderThenCreatedAt', () => {
  it('breaks ties with created_at', () => {
    const rows = [
      { id: 'b', sort_order: 0, created_at: '2026-01-02T00:00:00Z' },
      { id: 'a', sort_order: 0, created_at: '2026-01-01T00:00:00Z' },
    ];
    assert.deepEqual(
      sortBySortOrderThenCreatedAt(rows).map((row) => row.id),
      ['a', 'b'],
    );
  });
});

describe('adjacentMoveNeighborIndex', () => {
  it('returns null at list bounds', () => {
    assert.equal(adjacentMoveNeighborIndex(0, 3, -1), null);
    assert.equal(adjacentMoveNeighborIndex(2, 3, 1), null);
  });

  it('returns neighbor index inside the list', () => {
    assert.equal(adjacentMoveNeighborIndex(1, 3, -1), 0);
    assert.equal(adjacentMoveNeighborIndex(1, 3, 1), 2);
  });
});
