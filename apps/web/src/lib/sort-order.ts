/** -1 = move toward list start (up), 1 = move toward list end (down). */
export type SortOrderMoveDirection = -1 | 1;

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

export function compareSortOrderThenCreatedAt(
  a: { sort_order: number; created_at: string },
  b: { sort_order: number; created_at: string },
): number {
  return compareSortOrder(a, b) || a.created_at.localeCompare(b.created_at);
}

export function sortBySortOrderThenCreatedAt<T extends { sort_order: number; created_at: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(compareSortOrderThenCreatedAt);
}

/** Sort orders when moving row A past adjacent row B. */
export function adjacentSortOrdersAfterMove(
  a: { sort_order: number },
  b: { sort_order: number },
  direction: SortOrderMoveDirection,
): { sortOrderA: number; sortOrderB: number } {
  if (a.sort_order !== b.sort_order) {
    return { sortOrderA: b.sort_order, sortOrderB: a.sort_order };
  }
  if (direction === -1) {
    return { sortOrderA: b.sort_order - 1, sortOrderB: b.sort_order };
  }
  return { sortOrderA: b.sort_order + 1, sortOrderB: b.sort_order };
}

/** Apply an adjacent move to local rows (optimistic UI). */
export function applyAdjacentSortOrderMove<T extends { id: string; sort_order: number }>(
  rows: readonly T[],
  itemIdA: string,
  itemIdB: string,
  direction: SortOrderMoveDirection,
): T[] {
  const a = rows.find((row) => row.id === itemIdA);
  const b = rows.find((row) => row.id === itemIdB);
  if (!a || !b) return [...rows];
  const { sortOrderA, sortOrderB } = adjacentSortOrdersAfterMove(a, b, direction);
  return rows.map((row) => {
    if (row.id === itemIdA) return { ...row, sort_order: sortOrderA };
    if (row.id === itemIdB) return { ...row, sort_order: sortOrderB };
    return row;
  });
}

/** Neighbor index for a move within a sorted list, or null when out of range. */
export function adjacentMoveNeighborIndex(
  index: number,
  length: number,
  direction: SortOrderMoveDirection,
): number | null {
  const neighbor = index + direction;
  if (neighbor < 0 || neighbor >= length) return null;
  return neighbor;
}
