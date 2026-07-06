import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_TABLE_SEAT_MAX,
  DEFAULT_TABLE_SEAT_MIN,
  mergeTableLabelDrafts,
  parseRestaurantTablePatchRows,
  pickDirtyRestaurantTables,
  prepareRestaurantTableSettingsSave,
  projectRestaurantTablePatches,
  validateRestaurantTableSettings,
  type RestaurantTableRow,
} from './restaurant-tables';

const base = (id: string, display_name: string, sort_order: number): RestaurantTableRow => ({
  id,
  display_name,
  sort_order,
  seat_min: DEFAULT_TABLE_SEAT_MIN,
  seat_max: DEFAULT_TABLE_SEAT_MAX,
});

const tableA = base('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '001', 1);
const tableB = base('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '002', 2);
const tableC = base('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '003', 3);

describe('pickDirtyRestaurantTables', () => {
  it('returns only rows with changed seats or labels', () => {
    const tables = [
      tableA,
      { ...tableB, seat_max: 6 },
      tableC,
    ];
    const dirty = pickDirtyRestaurantTables(tables, [tableA, tableB, tableC], {});
    assert.deepEqual(dirty.map((row) => row.id), [tableB.id]);
  });

  it('includes label drafts before comparing to baseline', () => {
    const dirty = pickDirtyRestaurantTables([tableA, tableB], [tableA, tableB], {
      [tableA.id]: '010',
    });
    assert.deepEqual(dirty.map((row) => row.display_name), ['010']);
  });
});

describe('prepareRestaurantTableSettingsSave', () => {
  it('rejects duplicate names across the full set', () => {
    const tables = [tableA, { ...tableB, display_name: '001' }, tableC];
    const result = prepareRestaurantTableSettingsSave(tables, [tableA, tableB, tableC], {});
    assert.equal('error' in result && result.error, 'duplicate_name');
  });

  it('returns patches for changed rows only', () => {
    const tables = [tableA, { ...tableB, seat_max: 8 }, tableC];
    const result = prepareRestaurantTableSettingsSave(tables, [tableA, tableB, tableC], {});
    assert.equal('error' in result, false);
    if (!('error' in result)) {
      assert.deepEqual(result.patches.map((row) => row.id), [tableB.id]);
      assert.equal(result.merged[1].seat_max, 8);
    }
  });
});

describe('parseRestaurantTablePatchRows', () => {
  it('accepts partial updates for known tables', () => {
    const currentById = new Map([tableA, tableB, tableC].map((row) => [row.id, row]));
    const parsed = parseRestaurantTablePatchRows(
      [{ id: tableB.id, display_name: '002', seat_min: 2, seat_max: 8 }],
      currentById,
    );
    assert.equal('error' in parsed, false);
    if (!('error' in parsed)) {
      assert.equal(parsed.updates.length, 1);
      assert.equal(parsed.updates[0].seat_max, 8);
    }
  });

  it('rejects empty and unknown ids', () => {
    const currentById = new Map([[tableA.id, tableA]]);
    assert.equal(parseRestaurantTablePatchRows([], currentById).error, 'invalid_tables');
    assert.equal(
      parseRestaurantTablePatchRows(
        [{ id: tableB.id, display_name: '002', seat_min: 2, seat_max: 4 }],
        currentById,
      ).error,
      'invalid_tables',
    );
  });
});

describe('projectRestaurantTablePatches + validateRestaurantTableSettings', () => {
  it('detects rename conflicts after merge', () => {
    const projected = projectRestaurantTablePatches(
      [tableA, tableB, tableC],
      [{ ...tableB, display_name: '001' }],
    );
    assert.equal(validateRestaurantTableSettings(projected), 'duplicate_name');
  });

  it('passes when partial patch keeps names unique', () => {
    const projected = projectRestaurantTablePatches(
      [tableA, tableB, tableC],
      [{ ...tableB, seat_max: 9 }],
    );
    assert.equal(validateRestaurantTableSettings(projected), null);
  });
});

describe('mergeTableLabelDrafts', () => {
  it('overlays draft labels onto rows', () => {
    const merged = mergeTableLabelDrafts([tableA, tableB], { [tableA.id]: ' 010 ' });
    assert.equal(merged[0].display_name, '010');
    assert.equal(merged[1].display_name, '002');
  });
});
