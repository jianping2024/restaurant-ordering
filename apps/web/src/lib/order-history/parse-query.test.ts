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
    assert.equal(parsed.filters.sessionId, 'sess-9');
    const serialized = orderHistoryFiltersToSearchParams(0, 1, {
      tableIds: [],
      sessionId: 'sess-9',
    });
    assert.equal(serialized.get('sessionId'), 'sess-9');
  });
});
