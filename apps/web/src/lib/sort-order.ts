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
