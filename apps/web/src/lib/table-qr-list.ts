import type { RestaurantTableRow } from '@/lib/restaurant-tables';

export const TABLE_QR_PAGE_SIZE = 20;
export const TABLE_QR_ALL_GROUPS = '__all__';
export const TABLE_QR_UNGROUPED = '__ungrouped__';

export type TableQrGroupFilter = string;

export type TableQrListFilters = {
  search: string;
  groupId: TableQrGroupFilter;
};

export function normalizeTableQrSearch(raw: string): string {
  return raw.trim().toLowerCase();
}

export function filterTablesBySearch(
  tables: RestaurantTableRow[],
  search: string,
): RestaurantTableRow[] {
  const q = normalizeTableQrSearch(search);
  if (!q) return tables;
  return tables.filter((row) => row.display_name.toLowerCase().includes(q));
}

export function filterTablesByGroup(
  tables: RestaurantTableRow[],
  groupId: TableQrGroupFilter,
  groupIdByTableId: Record<string, string>,
): RestaurantTableRow[] {
  if (groupId === TABLE_QR_ALL_GROUPS) return tables;
  if (groupId === TABLE_QR_UNGROUPED) {
    return tables.filter((row) => !groupIdByTableId[row.id]);
  }
  return tables.filter((row) => groupIdByTableId[row.id] === groupId);
}

export function applyTableQrListFilters(
  tables: RestaurantTableRow[],
  filters: TableQrListFilters,
  groupIdByTableId: Record<string, string>,
): RestaurantTableRow[] {
  const byGroup = filterTablesByGroup(tables, filters.groupId, groupIdByTableId);
  return filterTablesBySearch(byGroup, filters.search);
}

export type PaginatedTables = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: RestaurantTableRow[];
};

export function paginateTables(
  tables: RestaurantTableRow[],
  page: number,
  pageSize: number = TABLE_QR_PAGE_SIZE,
): PaginatedTables {
  const total = tables.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    rows: tables.slice(start, start + pageSize),
  };
}

export function selectableTableIds(
  rows: RestaurantTableRow[],
  occupiedTableIds: ReadonlySet<string>,
): string[] {
  return rows.filter((row) => !occupiedTableIds.has(row.id)).map((row) => row.id);
}

export function isPageFullySelected(
  pageRows: RestaurantTableRow[],
  selectedIds: ReadonlySet<string>,
  occupiedTableIds: ReadonlySet<string>,
): boolean {
  const selectable = selectableTableIds(pageRows, occupiedTableIds);
  return selectable.length > 0 && selectable.every((id) => selectedIds.has(id));
}

export function resolveSelectedTables(
  tables: RestaurantTableRow[],
  selectedIds: ReadonlySet<string>,
): RestaurantTableRow[] {
  return tables.filter((row) => selectedIds.has(row.id));
}
