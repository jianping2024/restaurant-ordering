/** Max active tables per restaurant in settings. */
export const RESTAURANT_TABLE_LIST_MAX = 200;

/** Max length for display_name (letters, digits, - _). */
export const RESTAURANT_TABLE_LABEL_MAX_LEN = 16;

export const DEFAULT_TABLE_COUNT = 10;

/** Alphanumeric table labels: letter or digit first, then letters/digits/_/- */
export const TABLE_DISPLAY_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  display_name: string;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
}

export type RestaurantTableRow = Pick<
  RestaurantTable,
  'id' | 'display_name' | 'sort_order'
>;

export function normalizeTableDisplayName(raw: string): string {
  return raw.trim();
}

export function isValidTableDisplayName(value: string): boolean {
  const t = normalizeTableDisplayName(value);
  return (
    t.length >= 1
    && t.length <= RESTAURANT_TABLE_LABEL_MAX_LEN
    && TABLE_DISPLAY_NAME_PATTERN.test(t)
  );
}

export function parseTableIdParam(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  return UUID_RE.test(t) ? t : null;
}

export function formatDefaultTableDisplayName(index1Based: number): string {
  const n = Math.max(1, Math.floor(index1Based));
  return `A-${String(n).padStart(2, '0')}`;
}

/** Next A-xx label after existing active display names. */
export function nextDefaultTableDisplayName(existing: string[]): string {
  const re = /^A-(\d+)$/i;
  let max = 0;
  for (const name of existing) {
    const m = re.exec(normalizeTableDisplayName(name));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  if (max > 0) return formatDefaultTableDisplayName(max + 1);
  return formatDefaultTableDisplayName(existing.length + 1);
}

export function compareRestaurantTables(
  a: Pick<RestaurantTable, 'sort_order' | 'display_name'>,
  b: Pick<RestaurantTable, 'sort_order' | 'display_name'>,
): number {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.display_name.localeCompare(b.display_name, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function sortRestaurantTables<T extends RestaurantTableRow>(rows: T[]): T[] {
  return [...rows].sort(compareRestaurantTables);
}

export function tableIdsEqual(a: unknown, b: unknown): boolean {
  const left = parseTableIdParam(typeof a === 'string' ? a : '');
  const right = parseTableIdParam(typeof b === 'string' ? b : '');
  if (!left || !right) return false;
  return left === right;
}

/** Filter options: configured tables plus any table_id seen in orders. */
export function mergeTablesWithOrderHistory(
  tables: RestaurantTableRow[],
  orders: { table_id?: string | null; display_name?: string | null }[],
): RestaurantTableRow[] {
  const byId = new Map(tables.map((t) => [t.id, t]));
  for (const o of orders) {
    const id = parseTableIdParam(o.table_id ?? '');
    if (!id || byId.has(id)) continue;
    const label =
      typeof o.display_name === 'string' && o.display_name.trim()
        ? o.display_name.trim()
        : id.slice(0, 8);
    byId.set(id, { id, display_name: label, sort_order: 9999 });
  }
  return sortRestaurantTables(Array.from(byId.values()));
}

export function activeRestaurantTables(rows: RestaurantTable[]): RestaurantTable[] {
  return rows.filter((r) => !r.deleted_at);
}
