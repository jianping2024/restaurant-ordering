import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseDeleteTableIds,
  resolveDeleteTableTargets,
} from './restaurant-table-delete';
import type { RestaurantTableRow } from './restaurant-tables';

const tables: RestaurantTableRow[] = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', display_name: 'A-01', sort_order: 1 },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', display_name: 'A-02', sort_order: 2 },
];

describe('parseDeleteTableIds', () => {
  it('parses unique valid ids', () => {
    assert.deepEqual(parseDeleteTableIds([tables[0].id, tables[1].id]), [
      tables[0].id,
      tables[1].id,
    ]);
  });

  it('deduplicates ids', () => {
    assert.deepEqual(parseDeleteTableIds([tables[0].id, tables[0].id]), [tables[0].id]);
  });

  it('rejects empty and invalid ids', () => {
    assert.equal(parseDeleteTableIds([]), null);
    assert.equal(parseDeleteTableIds(['not-a-uuid']), null);
    assert.equal(parseDeleteTableIds('bad'), null);
  });
});

describe('resolveDeleteTableTargets', () => {
  it('resolves known tables in request order', () => {
    const resolved = resolveDeleteTableTargets([tables[1].id, tables[0].id], tables);
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.deepEqual(
        resolved.targets.map((row) => row.id),
        [tables[1].id, tables[0].id],
      );
    }
  });

  it('rejects unknown table ids', () => {
    const resolved = resolveDeleteTableTargets(
      ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
      tables,
    );
    assert.equal(resolved.ok, false);
    if (!resolved.ok) {
      assert.equal(resolved.error, 'tables_not_found');
    }
  });
});
