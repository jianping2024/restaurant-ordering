import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAbnormalOperationsListQuery } from './parse-list-query';

describe('parseAbnormalOperationsListQuery', () => {
  it('parses filters from search params', () => {
    const params = new URLSearchParams({
      start_date: '2026-06-01',
      end_date: '2026-06-07',
      type: 'ITEM_DELETED',
      risk_level: 'HIGH',
      status: 'PENDING',
      page: '2',
      page_size: '10',
    });
    const filters = parseAbnormalOperationsListQuery(params, 'rest-1');
    assert.equal(filters.restaurantId, 'rest-1');
    assert.equal(filters.startDate, '2026-06-01');
    assert.equal(filters.type, 'ITEM_DELETED');
    assert.equal(filters.page, 2);
    assert.equal(filters.pageSize, 10);
  });

  it('ignores invalid enum values', () => {
    const params = new URLSearchParams({
      type: 'REFUND',
      risk_level: 'CRITICAL',
      status: 'OPEN',
    });
    const filters = parseAbnormalOperationsListQuery(params, 'rest-1');
    assert.equal(filters.type, undefined);
    assert.equal(filters.riskLevel, undefined);
    assert.equal(filters.status, undefined);
  });
});
