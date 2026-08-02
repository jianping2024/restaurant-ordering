import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isListPageSize,
  LIST_DEFAULT_PAGE_SIZE,
  LIST_PAGE_SIZES,
  paginateList,
} from './paginate-list';

describe('paginateList', () => {
  const items = ['a', 'b', 'c', 'd'];

  it('returns page slices', () => {
    const page1 = paginateList(items, 1, 2);
    assert.equal(page1.totalPages, 2);
    assert.deepEqual(page1.rows, ['a', 'b']);
    const page2 = paginateList(items, 2, 2);
    assert.deepEqual(page2.rows, ['c', 'd']);
  });

  it('clamps page to valid range', () => {
    const out = paginateList(items, 99, 20);
    assert.equal(out.page, 1);
    assert.deepEqual(out.rows, items);
  });

  it('clamps empty list to page 1', () => {
    const out = paginateList([], 5, 10);
    assert.equal(out.page, 1);
    assert.equal(out.totalPages, 1);
    assert.deepEqual(out.rows, []);
  });
});

describe('list page sizes', () => {
  it('exposes 10 and 20 only, default 10', () => {
    assert.deepEqual([...LIST_PAGE_SIZES], [10, 20]);
    assert.equal(LIST_DEFAULT_PAGE_SIZE, 10);
    assert.equal(isListPageSize(10), true);
    assert.equal(isListPageSize(20), true);
    assert.equal(isListPageSize(15), false);
  });
});
