import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyOrderedSortOrders,
  applyPermutedSortOrders,
  compareSortOrder,
  moveIdInOrderedList,
  nextSortOrder,
  orderedIdsMatchSiblingSet,
  permuteSortOrderAssignments,
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

describe('moveIdInOrderedList', () => {
  it('moves an id to a new index', () => {
    assert.deepEqual(moveIdInOrderedList(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  });

  it('returns null when unchanged or out of range', () => {
    assert.equal(moveIdInOrderedList(['a', 'b'], 0, 0), null);
    assert.equal(moveIdInOrderedList(['a', 'b'], -1, 1), null);
  });
});

describe('orderedIdsMatchSiblingSet', () => {
  it('accepts a full permutation of sibling ids', () => {
    assert.equal(
      orderedIdsMatchSiblingSet([{ id: 'a' }, { id: 'b' }], ['b', 'a']),
      true,
    );
  });

  it('rejects extras, missing ids, or duplicates', () => {
    assert.equal(orderedIdsMatchSiblingSet([{ id: 'a' }], ['a', 'b']), false);
    assert.equal(orderedIdsMatchSiblingSet([{ id: 'a' }, { id: 'b' }], ['a', 'a']), false);
  });
});

describe('applyOrderedSortOrders', () => {
  it('assigns zero-based order from orderedIds', () => {
    const rows = [
      { id: 'a', sort_order: 0 },
      { id: 'b', sort_order: 1 },
      { id: 'c', sort_order: 2 },
    ];
    assert.deepEqual(
      applyOrderedSortOrders(rows, ['c', 'a', 'b']).map((row) => [row.id, row.sort_order]),
      [
        ['a', 1],
        ['b', 2],
        ['c', 0],
      ],
    );
  });
});

describe('applyPermutedSortOrders / permuteSortOrderAssignments', () => {
  it('reuses existing order values in sorted order', () => {
    const rows = [
      { id: 'a', sort_order: 10 },
      { id: 'b', sort_order: 30 },
      { id: 'c', sort_order: 20 },
      { id: 'x', sort_order: 99 },
    ];
    assert.deepEqual(
      applyPermutedSortOrders(rows, ['b', 'a', 'c']).map((row) => [row.id, row.sort_order]),
      [
        ['a', 20],
        ['b', 10],
        ['c', 30],
        ['x', 99],
      ],
    );
    assert.deepEqual(permuteSortOrderAssignments(rows.slice(0, 3), ['b', 'a', 'c']), [
      { id: 'b', sort_order: 10 },
      { id: 'a', sort_order: 20 },
      { id: 'c', sort_order: 30 },
    ]);
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
