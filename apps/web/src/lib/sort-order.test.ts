import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adjacentSortOrderSwapSteps,
  applyAdjacentSortOrderSwap,
  compareSortOrder,
  nextSortOrder,
  sortBySortOrderThenCreatedAt,
  swapAdjacentSortOrders,
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

describe('swapAdjacentSortOrders', () => {
  it('exchanges sort orders', () => {
    assert.deepEqual(swapAdjacentSortOrders({ sort_order: 2 }, { sort_order: 5 }), {
      sortOrderA: 5,
      sortOrderB: 2,
    });
  });
});

describe('adjacentSortOrderSwapSteps', () => {
  it('uses a temp slot above scope max for unique-index swaps', () => {
    assert.deepEqual(adjacentSortOrderSwapSteps({ sort_order: 0 }, { sort_order: 1 }, 39), {
      tempOrder: 40,
      finalSortOrderA: 1,
      finalSortOrderB: 0,
    });
  });

  it('avoids colliding with other rows when swapping non-zero orders', () => {
    assert.deepEqual(adjacentSortOrderSwapSteps({ sort_order: 6 }, { sort_order: 7 }, 39), {
      tempOrder: 40,
      finalSortOrderA: 7,
      finalSortOrderB: 6,
    });
  });

  it('returns null when rows already match target order', () => {
    assert.equal(
      adjacentSortOrderSwapSteps({ sort_order: 3 }, { sort_order: 3 }, 10),
      null,
    );
  });
});

describe('applyAdjacentSortOrderSwap', () => {
  it('updates only the swapped pair', () => {
    const rows = [
      { id: 'a', sort_order: 3 },
      { id: 'b', sort_order: 4 },
      { id: 'c', sort_order: 5 },
    ];
    const next = applyAdjacentSortOrderSwap(rows, 'b', 'a');
    assert.deepEqual(
      next.map((row) => [row.id, row.sort_order]),
      [
        ['a', 4],
        ['b', 3],
        ['c', 5],
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
