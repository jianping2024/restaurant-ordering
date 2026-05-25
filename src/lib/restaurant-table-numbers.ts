/** Max tables per restaurant in settings. */
export const RESTAURANT_TABLE_LIST_MAX = 200;

/** Min/max for a single table number value (custom labels like 101, 888). */
export const RESTAURANT_TABLE_VALUE_MIN = 1;
export const RESTAURANT_TABLE_VALUE_MAX = 9999;

export const DEFAULT_TABLE_COUNT = 10;

export function isValidTableNumberValue(n: number): boolean {
  return Number.isInteger(n) && n >= RESTAURANT_TABLE_VALUE_MIN && n <= RESTAURANT_TABLE_VALUE_MAX;
}

export function isValidConfiguredTableCount(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= RESTAURANT_TABLE_LIST_MAX;
}

export function parseValidTableNumber(raw: unknown): number | null {
  const n = Number(raw);
  return isValidTableNumberValue(n) ? n : null;
}

export function sequentialTableNumbers(count: number): number[] {
  const n = Math.min(
    RESTAURANT_TABLE_LIST_MAX,
    Math.max(1, Math.floor(count) || DEFAULT_TABLE_COUNT),
  );
  return Array.from({ length: n }, (_, i) => i + 1);
}

/** Normalize DB / API array: unique sorted integers within value bounds, capped at list max. */
export function normalizeRestaurantTableNumbers(raw: unknown): number[] {
  if (!Array.isArray(raw)) return sequentialTableNumbers(DEFAULT_TABLE_COUNT);
  const seen = new Set<number>();
  const out: number[] = [];
  for (const v of raw) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!isValidTableNumberValue(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  if (out.length === 0) return sequentialTableNumbers(DEFAULT_TABLE_COUNT);
  if (out.length > RESTAURANT_TABLE_LIST_MAX) return out.slice(0, RESTAURANT_TABLE_LIST_MAX);
  return out;
}

/** Grow or shrink the configured list; new slots get the next free integer. */
export function resizeTableNumbersList(current: number[], targetCount: number): number[] {
  const count = Math.min(
    RESTAURANT_TABLE_LIST_MAX,
    Math.max(1, Math.floor(targetCount) || 1),
  );
  const list = [...current];
  if (list.length > count) return list.slice(0, count);
  let candidate = list.length > 0 ? Math.max(...list) + 1 : 1;
  while (list.length < count) {
    while (list.includes(candidate)) candidate += 1;
    list.push(candidate);
    candidate += 1;
  }
  return list;
}

export function restaurantHasTableNumber(table: number, tableNumbers: number[]): boolean {
  return tableNumbers.includes(table);
}

/** Table filter options: configured tables plus any numbers seen in orders. */
export function mergeTableNumbersWithOrderHistory(
  tableNumbers: number[],
  orders: { table_number?: number | null }[],
): number[] {
  const set = new Set(tableNumbers);
  for (const o of orders) {
    const n = o.table_number;
    if (typeof n === 'number' && isValidTableNumberValue(n)) set.add(n);
  }
  return Array.from(set).sort((a, b) => a - b);
}
