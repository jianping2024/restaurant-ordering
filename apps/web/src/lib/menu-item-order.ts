import type { MenuItem } from '@/types';
import { compareSortOrder } from '@/lib/sort-order';

/** Stable scope key for menu_items.sort_order (null = uncategorized). */
export function menuItemSortScope(categoryId: string | null | undefined): string | null {
  return categoryId ?? null;
}

export function menuItemsShareSortScope(
  a: Pick<MenuItem, 'category_id'>,
  b: Pick<MenuItem, 'category_id'>,
): boolean {
  return menuItemSortScope(a.category_id) === menuItemSortScope(b.category_id);
}

/** Show dish reorder only when the visible list is one category scope and search is empty. */
export function canReorderVisibleMenuItems(items: readonly MenuItem[], searchQuery: string): boolean {
  if (searchQuery.trim() || items.length === 0) return false;
  const scope = menuItemSortScope(items[0].category_id);
  return items.every((item) => menuItemSortScope(item.category_id) === scope);
}

export function compareMenuItemsForDisplay(a: MenuItem, b: MenuItem): number {
  return compareSortOrder(a, b) || a.created_at.localeCompare(b.created_at);
}
