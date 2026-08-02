import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPS_LIST_DEFAULT_PAGE_SIZE,
  OPS_LIST_PAGE_SIZES,
  isOpsListPageSize,
  opsListEmptyPagePayload,
  opsListHref,
  opsListPageCount,
  isOpsListRangeUnsatisfiable,
  parseOpsListPage,
  parseOpsListPageSize,
  parseOpsListRangeTotal,
} from './ops-list-pagination';

describe('ops-list-pagination', () => {
  it('exposes 10/20 page sizes with default 20', () => {
    assert.deepEqual([...OPS_LIST_PAGE_SIZES], [10, 20]);
    assert.equal(OPS_LIST_DEFAULT_PAGE_SIZE, 20);
    assert.equal(isOpsListPageSize(10), true);
    assert.equal(isOpsListPageSize(20), true);
    assert.equal(isOpsListPageSize(30), false);
  });

  it('parseOpsListPage clamps and floors', () => {
    assert.equal(parseOpsListPage(new URLSearchParams()), 1);
    assert.equal(parseOpsListPage(new URLSearchParams('page=3')), 3);
    assert.equal(parseOpsListPage(new URLSearchParams('page=0')), 1);
    assert.equal(parseOpsListPage(new URLSearchParams('page=-2')), 1);
    assert.equal(parseOpsListPage(new URLSearchParams('page=2.9')), 2);
    assert.equal(parseOpsListPage(new URLSearchParams('page=abc')), 1);
  });

  it('parseOpsListPageSize defaults to 20 and accepts 10', () => {
    assert.equal(parseOpsListPageSize(new URLSearchParams()), 20);
    assert.equal(parseOpsListPageSize(new URLSearchParams('pageSize=10')), 10);
    assert.equal(parseOpsListPageSize(new URLSearchParams('pageSize=20')), 20);
    assert.equal(parseOpsListPageSize(new URLSearchParams('pageSize=30')), 20);
    assert.equal(parseOpsListPageSize(new URLSearchParams('pageSize=abc')), 20);
  });

  it('opsListPageCount uses response pageSize', () => {
    assert.equal(opsListPageCount(0, 20), 1);
    assert.equal(opsListPageCount(20, 20), 1);
    assert.equal(opsListPageCount(21, 20), 2);
    assert.equal(opsListPageCount(11, 10), 2);
  });

  it('opsListHref omits default pageSize and keeps non-default', () => {
    assert.equal(opsListHref('/ops/restaurants', 1), '/ops/restaurants?page=1');
    assert.equal(
      opsListHref('/ops/restaurants', 2, { q: '白云', plan: '', pageSize: '20' }),
      `/ops/restaurants?page=2&q=${encodeURIComponent('白云')}`,
    );
    assert.equal(
      opsListHref('/ops/audit', 1, { pageSize: '10' }),
      '/ops/audit?page=1&pageSize=10',
    );
  });

  it('detects unsatisfiable range and builds empty page payload', () => {
    assert.equal(
      isOpsListRangeUnsatisfiable({ code: 'PGRST103', message: 'Requested range not satisfiable' }),
      true,
    );
    assert.equal(isOpsListRangeUnsatisfiable({ code: 'other' }), false);
    assert.equal(
      parseOpsListRangeTotal({ details: 'An offset of 20 was requested, but there are only 4 rows.' }),
      4,
    );
    assert.deepEqual(
      opsListEmptyPagePayload(2, 10, {
        details: 'An offset of 20 was requested, but there are only 4 rows.',
      }),
      { items: [], page: 2, pageSize: 10, total: 4 },
    );
  });
});
