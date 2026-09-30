import type { MenuCategory } from '@/types';
import { compareSortOrder } from '@/lib/sort-order';

/** Droppable / type id for one parent scope (root = null). Same type ⇒ no cross-parent drop. */
export function categorySiblingDroppableId(parentId: string | null): string {
  return parentId ? `menu-cat-siblings:${parentId}` : 'menu-cat-siblings:root';
}

/** Parse droppable id → parent scope; undefined when not a category-sibling droppable. */
export function parseCategorySiblingDroppableId(droppableId: string): string | null | undefined {
  const prefix = 'menu-cat-siblings:';
  if (!droppableId.startsWith(prefix)) return undefined;
  const rest = droppableId.slice(prefix.length);
  if (rest === 'root') return null;
  return rest || undefined;
}

/** Active siblings under the same parent (null = top-level), sorted by sort_order. */
export function menuCategorySiblingsInScope(
  categories: readonly MenuCategory[],
  parentId: string | null,
  excludeId?: string,
): MenuCategory[] {
  return categories
    .filter(
      (c) =>
        c.active &&
        (c.parent_id || null) === parentId &&
        (!excludeId || c.id !== excludeId),
    )
    .sort(compareSortOrder);
}
