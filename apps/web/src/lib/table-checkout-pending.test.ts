import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkoutRequestedAtByTableIdFromRows,
  checkoutRequestedAtForTable,
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

describe('checkoutRequestedAtByTableIdFromRows', () => {
  it('keeps the latest created_at per table', () => {
    assert.deepEqual(
      checkoutRequestedAtByTableIdFromRows([
        { table_id: 'a', created_at: '2026-01-01T10:00:00.000Z' },
        { table_id: 'a', created_at: '2026-01-01T11:00:00.000Z' },
        { table_id: 'b', created_at: '2026-01-01T09:00:00.000Z' },
      ]),
      {
        a: '2026-01-01T11:00:00.000Z',
        b: '2026-01-01T09:00:00.000Z',
      },
    );
  });
});

describe('checkoutRequestedAtForTable', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440000';

  it('matches ids with tableIdsEqual semantics', () => {
    assert.equal(
      checkoutRequestedAtForTable(tableId, {
        [tableId]: '2026-01-01T11:00:00.000Z',
      }),
      '2026-01-01T11:00:00.000Z',
    );
    assert.equal(checkoutRequestedAtForTable(tableId, {}), null);
  });
});
