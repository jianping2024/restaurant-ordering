import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkoutRequestedTableIdsFromRows,
  isTableCheckoutRequested,
} from './table-checkout-pending';

describe('checkoutRequestedTableIdsFromRows', () => {
  it('dedupes table ids and drops empty values', () => {
    assert.deepEqual(
      checkoutRequestedTableIdsFromRows([
        { table_id: 'a' },
        { table_id: 'a' },
        { table_id: 'b' },
        { table_id: null },
        {},
      ]),
      ['a', 'b'],
    );
  });
});

describe('isTableCheckoutRequested', () => {
  it('matches table ids with tableIdsEqual semantics', () => {
    const tableId = '550e8400-e29b-41d4-a716-446655440000';
    assert.equal(isTableCheckoutRequested(tableId, [tableId]), true);
    assert.equal(isTableCheckoutRequested(tableId, ['other-table']), false);
  });
});
