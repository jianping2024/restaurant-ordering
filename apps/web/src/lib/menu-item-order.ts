import type { MenuItem } from '@/types';
import { compareSortOrderThenCreatedAt } from '@/lib/sort-order';

/** Stable scope key for menu_items.sort_order (null = uncategorized). */
export function menuItemSortScope(categoryId: string | null | undefined): string | null {
  return categoryId ?? null;
}

/** Show dish reorder only when the visible list is one category scope and search is empty. */
export function canReorderVisibleMenuItems(items: readonly MenuItem[], searchQuery: string): boolean {
  if (searchQuery.trim() || items.length === 0) return false;
  const scope = menuItemSortScope(items[0].category_id);
  return items.every((item) => menuItemSortScope(item.category_id) === scope);
}

export function compareMenuItemsForDisplay(a: MenuItem, b: MenuItem): number {
  return compareSortOrderThenCreatedAt(a, b);
}

export function menuItemSiblingsInScope(
  items: readonly MenuItem[],
  categoryId: string | null,
  excludeId?: string,
): MenuItem[] {
  return items.filter(
    (item) => item.category_id === categoryId && (!excludeId || item.id !== excludeId),
  );
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
export function applyOrderedMenuItemSortOrders<T extends { id: string; sort_order: number }>(
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
