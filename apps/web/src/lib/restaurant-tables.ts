/** Max active tables per restaurant in settings. */
export const RESTAURANT_TABLE_LIST_MAX = 200;

/** Max length for display_name (letters, digits, - _). */
export const RESTAURANT_TABLE_LABEL_MAX_LEN = 16;

export const DEFAULT_TABLE_COUNT = 10;

export const TABLE_SEAT_MIN = 1;
export const TABLE_SEAT_MAX = 99;
export const DEFAULT_TABLE_SEAT_MIN = 2;
export const DEFAULT_TABLE_SEAT_MAX = 4;

/** Alphanumeric table labels: letter or digit first, then letters/digits/_/- */
export const TABLE_DISPLAY_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  display_name: string;
  sort_order: number;
  seat_min: number;
  seat_max: number;
  deleted_at: string | null;
  created_at: string;
}

export type RestaurantTableRow = Pick<
  RestaurantTable,
  'id' | 'display_name' | 'sort_order' | 'seat_min' | 'seat_max'
>;

export function normalizeTableSeatCount(raw: unknown, fallback: number): number {
  const n = typeof raw === 'number' ? Math.floor(raw) : Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(TABLE_SEAT_MAX, Math.max(TABLE_SEAT_MIN, n));
}

export function normalizeTableSeatRange(
  seatMinRaw: unknown,
  seatMaxRaw: unknown,
): { seat_min: number; seat_max: number } | null {
  const seat_min = normalizeTableSeatCount(seatMinRaw, DEFAULT_TABLE_SEAT_MIN);
  const seat_max = normalizeTableSeatCount(seatMaxRaw, DEFAULT_TABLE_SEAT_MAX);
  if (seat_min > seat_max) return null;
  return { seat_min, seat_max };
}

export function isValidTableSeatRange(seatMin: number, seatMax: number): boolean {
  return (
    Number.isInteger(seatMin)
    && Number.isInteger(seatMax)
    && seatMin >= TABLE_SEAT_MIN
    && seatMax <= TABLE_SEAT_MAX
    && seatMin <= seatMax
  );
}

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

/** Sequential default names for batch add (each name unique within batch). */
export function nextDefaultTableDisplayNames(existing: string[], count: number): string[] {
  const n = Math.max(0, Math.floor(count));
  const pool = [...existing];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const next = nextDefaultTableDisplayName(pool);
    out.push(next);
    pool.push(next);
  }
  return out;
}

export function isValidTableAddCount(count: number, currentCount: number): boolean {
  return (
    Number.isInteger(count)
    && count >= 1
    && currentCount + count <= RESTAURANT_TABLE_LIST_MAX
  );
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
    byId.set(id, {
      id,
      display_name: label,
      sort_order: 9999,
      seat_min: DEFAULT_TABLE_SEAT_MIN,
      seat_max: DEFAULT_TABLE_SEAT_MAX,
    });
  }
  return sortRestaurantTables(Array.from(byId.values()));
}

export function activeRestaurantTables(rows: RestaurantTable[]): RestaurantTable[] {
  return rows.filter((r) => !r.deleted_at);
}

/** Apply in-progress display_name drafts onto table rows. */
export function mergeTableLabelDrafts(
  tables: RestaurantTableRow[],
  labelDrafts: Record<string, string>,
): RestaurantTableRow[] {
  return tables.map((row) => {
    const raw = labelDrafts[row.id];
    if (raw === undefined) return row;
    return { ...row, display_name: normalizeTableDisplayName(raw) };
  });
}

export function restaurantTableSettingsEqual(
  a: RestaurantTableRow,
  b: RestaurantTableRow,
): boolean {
  return (
    a.display_name === b.display_name
    && a.seat_min === b.seat_min
    && a.seat_max === b.seat_max
  );
}

/** Rows whose display_name or seat range differs from the saved baseline. */
export function pickDirtyRestaurantTables(
  tables: RestaurantTableRow[],
  savedTables: RestaurantTableRow[],
  labelDrafts: Record<string, string>,
): RestaurantTableRow[] {
  const merged = mergeTableLabelDrafts(tables, labelDrafts);
  const savedById = new Map(savedTables.map((row) => [row.id, row]));
  return merged.filter((row) => {
    const saved = savedById.get(row.id);
    return !saved || !restaurantTableSettingsEqual(row, saved);
  });
}

export function hasUnsavedRestaurantTableChanges(
  tables: RestaurantTableRow[],
  savedTables: RestaurantTableRow[],
  labelDrafts: Record<string, string>,
): boolean {
  if (tables.length !== savedTables.length) return true;
  return pickDirtyRestaurantTables(tables, savedTables, labelDrafts).length > 0;
}

export type RestaurantTableSettingsValidationError =
  | 'invalid_label'
  | 'invalid_seat'
  | 'duplicate_name';

export function validateRestaurantTableSettings(
  tables: RestaurantTableRow[],
): RestaurantTableSettingsValidationError | null {
  for (const row of tables) {
    if (!isValidTableDisplayName(row.display_name)) return 'invalid_label';
    if (!isValidTableSeatRange(row.seat_min, row.seat_max)) return 'invalid_seat';
  }
  const names = tables.map((row) => row.display_name);
  if (new Set(names).size !== names.length) return 'duplicate_name';
  return null;
}

export function projectRestaurantTablePatches(
  current: RestaurantTableRow[],
  patches: RestaurantTableRow[],
): RestaurantTableRow[] {
  const patchById = new Map(patches.map((row) => [row.id, row]));
  return current.map((row) => patchById.get(row.id) ?? row);
}

export function parseRestaurantTablePatchRows(
  rawTables: unknown,
  currentById: Map<string, RestaurantTableRow>,
): { updates: RestaurantTableRow[] } | { error: 'invalid_tables' | 'invalid_seat_range' } {
  if (!Array.isArray(rawTables) || rawTables.length === 0) {
    return { error: 'invalid_tables' };
  }

  const updates: RestaurantTableRow[] = [];
  const seenIds = new Set<string>();

  for (const row of rawTables) {
    if (!row || typeof row !== 'object') {
      return { error: 'invalid_tables' };
    }
    const raw = row as Record<string, unknown>;
    const id = parseTableIdParam(raw.id);
    const displayName = normalizeTableDisplayName(
      typeof raw.display_name === 'string' ? raw.display_name : '',
    );
    if (!id || !currentById.has(id) || !isValidTableDisplayName(displayName)) {
      return { error: 'invalid_tables' };
    }
    if (seenIds.has(id)) return { error: 'invalid_tables' };
    seenIds.add(id);

    const seatRange = normalizeTableSeatRange(raw.seat_min, raw.seat_max);
    if (!seatRange) return { error: 'invalid_seat_range' };

    updates.push({
      id,
      display_name: displayName,
      sort_order: currentById.get(id)!.sort_order,
      seat_min: seatRange.seat_min,
      seat_max: seatRange.seat_max,
    });
  }

  return { updates };
}

export function prepareRestaurantTableSettingsSave(
  tables: RestaurantTableRow[],
  savedTables: RestaurantTableRow[],
  labelDrafts: Record<string, string>,
):
  | { merged: RestaurantTableRow[]; patches: RestaurantTableRow[] }
  | { error: RestaurantTableSettingsValidationError } {
  const merged = mergeTableLabelDrafts(tables, labelDrafts);
  const validationError = validateRestaurantTableSettings(merged);
  if (validationError) return { error: validationError };
  const patches = pickDirtyRestaurantTables(tables, savedTables, labelDrafts);
  return { merged, patches };
}
