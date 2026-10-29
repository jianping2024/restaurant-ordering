import {
  compareMenuItemsForDisplay,
  menuItemSiblingsInScope,
} from '@/lib/menu-item-order';
import { menuCategorySiblingsInScope } from '@/lib/menu-category-order';
import type { MenuCategory, MenuItem } from '@/types';

/**
 * Sole browse order for waiter「已点」within a money band: category tree
 * (active siblings by sort_order, depth-first) then dishes in each category
 * ({@link compareMenuItemsForDisplay}). Same mental map as staff ordering nav.
 */
export function buildMenuCatalogBrowseRankByItemId(
  categories: readonly MenuCategory[],
  items: readonly MenuItem[],
): Map<string, number> {
  const rank = new Map<string, number>();
  let next = 0;

  const assign = (item: MenuItem) => {
    if (rank.has(item.id)) return;
    rank.set(item.id, next);
    next += 1;
  };

  const visit = (parentId: string | null) => {
    for (const category of menuCategorySiblingsInScope(categories, parentId)) {
      for (const item of [...menuItemSiblingsInScope(items, category.id)].sort(
        compareMenuItemsForDisplay,
      )) {
        assign(item);
      }
      visit(category.id);
    }
  };

  visit(null);

  for (const item of [...items].sort(compareMenuItemsForDisplay)) {
    assign(item);
  }

  return rank;
}
