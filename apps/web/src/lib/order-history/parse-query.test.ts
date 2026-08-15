import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultOrderHistoryClosedRange } from './date-range';
import {
  orderHistoryFiltersToSearchParams,
  parseOrderHistorySearchParams,
} from './parse-query';

describe('parseOrderHistorySearchParams sessionId', () => {
  it('parses and serializes sessionId for single-entry fetch', () => {
    const parsed = parseOrderHistorySearchParams(
      new URLSearchParams({ sessionId: 'sess-9', limit: '1' }),
    );
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
  it('forces today when dates omitted', () => {
    const expected = defaultOrderHistoryClosedRange();
    const parsed = parseOrderHistorySearchParams(new URLSearchParams());
    assert.deepEqual(
      { closedFrom: parsed.filters.closedFrom, closedTo: parsed.filters.closedTo },
      expected,
    );
  });

  it('forces today even when client sends a multi-day range', () => {
    const expected = defaultOrderHistoryClosedRange();
    const parsed = parseOrderHistorySearchParams(
      new URLSearchParams({
        closedFrom: '2026-07-01',
        closedTo: '2026-08-01',
      }),
    );
    assert.deepEqual(
      { closedFrom: parsed.filters.closedFrom, closedTo: parsed.filters.closedTo },
      expected,
    );
  });

  it('accepts page size 20', () => {
    const parsed = parseOrderHistorySearchParams(
      new URLSearchParams({
        closedFrom: '2026-08-01',
        closedTo: '2026-08-07',
        limit: '20',
      }),
    );
    assert.equal(parsed.limit, 20);
  });
});
