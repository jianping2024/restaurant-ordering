import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPS_LIST_PAGE_SIZE,
  OPS_LIST_PAGE_SIZE_DENSE,
  opsListHref,
  opsListPageCount,
  isOpsListRangeUnsatisfiable,
  opsListEmptyPagePayload,
  parseOpsListPage,
  parseOpsListRangeTotal,
} from './ops-list-pagination';

describe('ops-list-pagination', () => {
  it('exposes shared page sizes', () => {
    assert.equal(OPS_LIST_PAGE_SIZE, 20);
    assert.equal(OPS_LIST_PAGE_SIZE_DENSE, 30);
  });

  it('parseOpsListPage clamps and floors', () => {
    assert.equal(parseOpsListPage(new URLSearchParams()), 1);
    assert.equal(parseOpsListPage(new URLSearchParams('page=3')), 3);
    assert.equal(parseOpsListPage(new URLSearchParams('page=0')), 1);
    assert.equal(parseOpsListPage(new URLSearchParams('page=-2')), 1);
    assert.equal(parseOpsListPage(new URLSearchParams('page=2.9')), 2);
    assert.equal(parseOpsListPage(new URLSearchParams('page=abc')), 1);
  });

  it('opsListPageCount uses response pageSize', () => {
    assert.equal(opsListPageCount(0, 20), 1);
    assert.equal(opsListPageCount(20, 20), 1);
    assert.equal(opsListPageCount(21, 20), 2);
    assert.equal(opsListPageCount(60, 30), 2);
    assert.equal(opsListPageCount(61, 30), 3);
  });

  it('opsListHref always sets page and skips empty filters', () => {
    assert.equal(opsListHref('/ops/restaurants', 1), '/ops/restaurants?page=1');
    assert.equal(
      opsListHref('/ops/restaurants', 2, { q: '白云', plan: '', ownerEmail: undefined }),
      `/ops/restaurants?page=2&q=${encodeURIComponent('白云')}`,
    );
    assert.equal(
      opsListHref('/ops/print/pairings', 1, { pending: '0' }),
      '/ops/print/pairings?page=1&pending=0',
    );
  });

  it('detects unsatisfiable range and builds empty page payload', () => {
    assert.equal(isOpsListRangeUnsatisfiable({ code: 'PGRST103', message: 'Requested range not satisfiable' }), true);
    assert.equal(isOpsListRangeUnsatisfiable({ code: 'other' }), false);
    assert.equal(
      parseOpsListRangeTotal({ details: 'An offset of 20 was requested, but there are only 4 rows.' }),
      4,
    );
    assert.equal(parseOpsListRangeTotal({ details: null }), 0);
    assert.deepEqual(
      opsListEmptyPagePayload(2, 20, {
        details: 'An offset of 20 was requested, but there are only 4 rows.',
      }),
      { items: [], page: 2, pageSize: 20, total: 4 },
    );
  });
});
