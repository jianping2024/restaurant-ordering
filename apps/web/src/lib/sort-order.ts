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

/** Move one id within an ordered list; returns null when indexes are invalid or unchanged. */
export function moveIdInOrderedList(
  ids: readonly string[],
  fromIndex: number,
  toIndex: number,
): string[] | null {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= ids.length ||
    toIndex >= ids.length
  ) {
    return null;
  }
  const next = [...ids];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  return next;
}

/** True when orderedIds is exactly the sibling id set (same length, no extras/dupes). */
export function orderedIdsMatchSiblingSet(
  siblings: readonly { id: string }[],
  orderedIds: readonly string[],
): boolean {
  if (siblings.length !== orderedIds.length || orderedIds.length === 0) return false;
  if (new Set(orderedIds).size !== orderedIds.length) return false;
  const siblingIds = new Set(siblings.map((row) => row.id));
  return orderedIds.every((id) => siblingIds.has(id));
}

/** Optimistic UI: assign sort_order from orderedIds index for matching rows. */
export function applyOrderedSortOrders<T extends { id: string; sort_order: number }>(
  rows: readonly T[],
  orderedIds: readonly string[],
): T[] {
  const orderIndex = new Map(orderedIds.map((id, index) => [id, index]));
  return rows.map((row) => {
    const nextOrder = orderIndex.get(row.id);
    if (nextOrder === undefined || row.sort_order === nextOrder) return row;
    return { ...row, sort_order: nextOrder };
  });
}

/**
 * Optimistic UI for member-table reorder: reassign the existing sort_order values
 * (sorted ascending) onto the new id order without inventing new numbers.
 */
export function applyPermutedSortOrders<T extends { id: string; sort_order: number }>(
  rows: readonly T[],
  orderedIds: readonly string[],
): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const scoped = orderedIds
    .map((id) => byId.get(id))
    .filter((row): row is T => row != null);
  if (scoped.length !== orderedIds.length) return [...rows];
  const orders = [...scoped.map((row) => row.sort_order)].sort((a, b) => a - b);
  const assigned = new Map(orderedIds.map((id, index) => [id, orders[index]!]));
  return rows.map((row) => {
    const nextOrder = assigned.get(row.id);
    if (nextOrder === undefined || row.sort_order === nextOrder) return row;
    return { ...row, sort_order: nextOrder };
  });
}

/** Build { id, sort_order } assignments by permuting existing order values onto orderedIds. */
export function permuteSortOrderAssignments(
  siblings: readonly { id: string; sort_order: number }[],
  orderedIds: readonly string[],
): { id: string; sort_order: number }[] | null {
  if (!orderedIdsMatchSiblingSet(siblings, orderedIds)) return null;
  const orders = [...siblings.map((row) => row.sort_order)].sort((a, b) => a - b);
  return orderedIds.map((id, index) => ({ id, sort_order: orders[index]! }));
}
