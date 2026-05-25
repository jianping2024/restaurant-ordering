/** Max tables per restaurant in settings. */
export const RESTAURANT_TABLE_LIST_MAX = 200;

/** Max length for a single table label (letters, digits, - _). */
export const RESTAURANT_TABLE_LABEL_MAX_LEN = 16;

export const DEFAULT_TABLE_COUNT = 10;

/** Alphanumeric table labels: letter or digit first, then letters/digits/_/- */
export const TABLE_NUMBER_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export type TableNumber = string;

export function normalizeTableNumberInput(raw: string): string {
  return raw.trim();
}

export function isValidTableNumberValue(value: string): boolean {
  const t = normalizeTableNumberInput(value);
  return (
    t.length >= 1
    && t.length <= RESTAURANT_TABLE_LABEL_MAX_LEN
    && TABLE_NUMBER_LABEL_PATTERN.test(t)
  );
}

export function parseTableNumberParam(raw: unknown, fallback = '1'): TableNumber {
  return parseTableNumberParamOrNull(raw) ?? fallback;
}

export function parseTableNumberParamOrNull(raw: unknown): TableNumber | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const s = String(Math.trunc(raw));
    return isValidTableNumberValue(s) ? s : null;
  }
  if (typeof raw === 'string') {
    const t = normalizeTableNumberInput(raw);
    return isValidTableNumberValue(t) ? t : null;
  }
  return null;
}

export function isValidConfiguredTableCount(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= RESTAURANT_TABLE_LIST_MAX;
}

export function compareTableNumbers(a: TableNumber, b: TableNumber): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function sequentialTableNumbers(count: number): TableNumber[] {
  const n = Math.min(
    RESTAURANT_TABLE_LIST_MAX,
    Math.max(1, Math.floor(count) || DEFAULT_TABLE_COUNT),
  );
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

export function parseStoredTableNumber(raw: unknown): TableNumber | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return isValidTableNumberValue(String(Math.trunc(raw))) ? String(Math.trunc(raw)) : null;
  }
  if (typeof raw === 'string') {
    const t = normalizeTableNumberInput(raw);
    return isValidTableNumberValue(t) ? t : null;
  }
  return null;
}

/** Normalize DB / API array: unique sorted labels, capped at list max. */
export function normalizeRestaurantTableNumbers(raw: unknown): TableNumber[] {
  if (!Array.isArray(raw)) return sequentialTableNumbers(DEFAULT_TABLE_COUNT);
  const seen = new Set<string>();
  const out: TableNumber[] = [];
  for (const v of raw) {
    const label = parseStoredTableNumber(v);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  if (out.length === 0) return sequentialTableNumbers(DEFAULT_TABLE_COUNT);
  out.sort(compareTableNumbers);
  if (out.length > RESTAURANT_TABLE_LIST_MAX) return out.slice(0, RESTAURANT_TABLE_LIST_MAX);
  return out;
}

function nextDefaultTableLabel(existing: TableNumber[]): TableNumber {
  const numeric = existing
    .map((s) => (/^\d+$/.test(s) ? Number(s) : NaN))
    .filter((n) => Number.isFinite(n));
  if (numeric.length === existing.length && existing.length > 0) {
    let candidate = Math.max(...numeric) + 1;
    while (existing.includes(String(candidate))) candidate += 1;
    return String(candidate);
  }
  let candidate = 1;
  while (existing.includes(String(candidate))) candidate += 1;
  return String(candidate);
}

/** Grow or shrink the configured list; new slots get the next default label. */
export function resizeTableNumbersList(current: TableNumber[], targetCount: number): TableNumber[] {
  const count = Math.min(
    RESTAURANT_TABLE_LIST_MAX,
    Math.max(1, Math.floor(targetCount) || 1),
  );
  const list = [...current];
  if (list.length > count) return list.slice(0, count);
  while (list.length < count) {
    list.push(nextDefaultTableLabel(list));
  }
  return list;
}

export function restaurantHasTableNumber(table: TableNumber, tableNumbers: TableNumber[]): boolean {
  return tableNumbers.includes(table);
}

/** Table filter options: configured tables plus any labels seen in orders. */
export function mergeTableNumbersWithOrderHistory(
  tableNumbers: TableNumber[],
  orders: { table_number?: string | number | null }[],
): TableNumber[] {
  const set = new Set(tableNumbers);
  for (const o of orders) {
    const label = parseStoredTableNumber(o.table_number);
    if (label) set.add(label);
  }
  return Array.from(set).sort(compareTableNumbers);
}
