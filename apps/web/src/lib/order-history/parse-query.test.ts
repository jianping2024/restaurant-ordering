import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  orderHistoryFiltersToSearchParams,
  parseOrderHistorySearchParams,
} from './parse-query';

describe('parseOrderHistorySearchParams sessionId', () => {
  it('parses and serializes sessionId for single-entry fetch', () => {
    const parsed = parseOrderHistorySearchParams(
      new URLSearchParams({ sessionId: 'sess-9', limit: '1' }),
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.filters.sessionId, 'sess-9');
    assert.equal(parsed.limit, 1);
    const serialized = orderHistoryFiltersToSearchParams(0, 1, {
      tableIds: [],
      sessionId: 'sess-9',
    });
    assert.equal(serialized.get('sessionId'), 'sess-9');
  });
});

describe('parseOrderHistorySearchParams date window', () => {
  it('defaults to last-7 when dates omitted', () => {
    const parsed = parseOrderHistorySearchParams(new URLSearchParams());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.ok(parsed.filters.closedFrom);
    assert.ok(parsed.filters.closedTo);
  });

  it('rejects ranges longer than 31 days', () => {
    const parsed = parseOrderHistorySearchParams(
      new URLSearchParams({
        closedFrom: '2026-07-01',
        closedTo: '2026-08-01',
      }),
    );
    assert.deepEqual(parsed, { ok: false, code: 'invalid_date_range' });
  });

  it('accepts page size 20', () => {
    const parsed = parseOrderHistorySearchParams(
      new URLSearchParams({
        closedFrom: '2026-08-01',
        closedTo: '2026-08-07',
        limit: '20',
      }),
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.limit, 20);
  });
});
