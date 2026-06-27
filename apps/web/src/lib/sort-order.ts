/** Next sort_order for a new row appended after existing siblings in the same scope. */
export function nextSortOrder(existing: ReadonlyArray<{ sort_order: number }>): number {
  if (existing.length === 0) return 0;
  return Math.max(...existing.map((row) => row.sort_order)) + 1;
}

export function compareSortOrder(
  a: { sort_order: number },
  b: { sort_order: number },
): number {
  return a.sort_order - b.sort_order;
}

export function swapSortOrderFields<T extends { sort_order: number }>(a: T, b: T): void {
  const tmp = a.sort_order;
  a.sort_order = b.sort_order;
  b.sort_order = tmp;
}

export function compareSortOrderThenCreatedAt(
  a: { sort_order: number; created_at?: string },
  b: { sort_order: number; created_at?: string },
): number {
  return compareSortOrder(a, b) || (a.created_at ?? '').localeCompare(b.created_at ?? '');
}

export function sortBySortOrderThenCreatedAt<T extends { sort_order: number; created_at?: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(compareSortOrderThenCreatedAt);
}
