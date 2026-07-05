import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyTableQrListFilters,
  filterTablesBySearch,
  isPageFullySelected,
  paginateTables,
  selectableTableIds,
  TABLE_QR_PAGE_SIZE,
  TABLE_QR_UNGROUPED,
} from './table-qr-list';
import type { RestaurantTableRow } from './restaurant-tables';

const tables: RestaurantTableRow[] = [
  { id: 't1', display_name: 'A-01', sort_order: 1 },
  { id: 't2', display_name: 'A-02', sort_order: 2 },
  { id: 't3', display_name: 'B-01', sort_order: 3 },
  { id: 't4', display_name: 'B-02', sort_order: 4 },
];

const groupIdByTableId = { t1: 'g1', t2: 'g1', t3: 'g2' };

describe('filterTablesBySearch', () => {
  it('matches display_name substring case-insensitively', () => {
    assert.deepEqual(filterTablesBySearch(tables, 'a-0').map((r) => r.id), ['t1', 't2']);
  });
});

describe('applyTableQrListFilters', () => {
  it('filters by group then search', () => {
    const filtered = applyTableQrListFilters(
      tables,
      { search: 'B', groupId: 'g2' },
      groupIdByTableId,
    );
    assert.deepEqual(filtered.map((r) => r.id), ['t3']);
  });

  it('filters ungrouped tables', () => {
    const filtered = applyTableQrListFilters(
      tables,
      { search: '', groupId: TABLE_QR_UNGROUPED },
      groupIdByTableId,
    );
    assert.deepEqual(filtered.map((r) => r.id), ['t4']);
  });
});

describe('paginateTables', () => {
  it('returns page slices', () => {
    const page1 = paginateTables(tables, 1, 2);
    assert.equal(page1.totalPages, 2);
    assert.deepEqual(page1.rows.map((r) => r.id), ['t1', 't2']);
    const page2 = paginateTables(tables, 2, 2);
    assert.deepEqual(page2.rows.map((r) => r.id), ['t3', 't4']);
  });

  it('clamps page to valid range', () => {
    const out = paginateTables(tables, 99, TABLE_QR_PAGE_SIZE);
    assert.equal(out.page, 1);
  });
});

describe('selection helpers', () => {
  it('selectableTableIds skips occupied tables', () => {
    const occupied = new Set(['t1']);
    assert.deepEqual(selectableTableIds(tables.slice(0, 2), occupied), ['t2']);
  });

  it('isPageFullySelected requires all selectable rows on page', () => {
    const occupied = new Set<string>();
    const pageRows = tables.slice(0, 2);
    assert.equal(isPageFullySelected(pageRows, new Set(['t1']), occupied), false);
    assert.equal(isPageFullySelected(pageRows, new Set(['t1', 't2']), occupied), true);
  });
});
