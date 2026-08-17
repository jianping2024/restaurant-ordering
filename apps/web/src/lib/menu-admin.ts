import type { MenuCategory, MenuItem } from '@/types';
import type { UILanguage } from '@/lib/i18n';
import { categoryCodePathFromLeaf, formatMenuPrintDisplayName } from '@/lib/menu-print-label';

export const MAX_MENU_CATEGORY_DEPTH = 5;

export function getMenuCategoryLabel(c: MenuCategory, lang: UILanguage): string {
  if (lang === 'en') return c.name_en?.trim() || c.name_pt;
  if (lang === 'zh') return c.name_zh?.trim() || c.name_pt;
  return c.name_pt;
}

export function getMenuItemDisplayName(item: MenuItem, lang: UILanguage): string {
  if (lang === 'en') return item.name_en?.trim() || item.name_pt;
  if (lang === 'zh') return item.name_zh?.trim() || item.name_pt;
  return item.name_pt;
}

/** Example ticket prefix for a category node (no dish code). */
export function categoryTicketCodePreview(
  categoryId: string,
  categories: MenuCategory[],
): string {
  const path = categoryCodePathFromLeaf(categoryId, categories);
  if (path.length === 0) return '';
  return formatMenuPrintDisplayName({
    categoryPath: path,
    itemCode: null,
    itemName: '…',
  }).replace(/-…$/, '');
}

/** Category id and all descendant category ids (includes root). */
export function collectCategorySubtreeIds(
  rootId: string,
  categories: MenuCategory[],
): string[] {
  const ids: string[] = [rootId];
  const walk = (parentId: string) => {
    for (const c of categories) {
      if (c.parent_id === parentId) {
        ids.push(c.id);
        walk(c.id);
      }
    }
  };
  walk(rootId);
  return ids;
}

export function categoryHasDescendants(
  categoryId: string,
  categories: MenuCategory[],
): boolean {
  return categories.some((c) => c.parent_id === categoryId);
}

/** Delete children before parents (parent_id FK). */
export function sortCategoryIdsLeavesFirst(
  ids: string[],
  categories: MenuCategory[],
): string[] {
  const set = new Set(ids);
  const depth = (id: string): number => {
    const row = categories.find((c) => c.id === id);
    if (!row?.parent_id || !set.has(row.parent_id)) return 0;
    return 1 + depth(row.parent_id);
  };
  return [...ids].sort((a, b) => depth(b) - depth(a));
}

export function itemMatchesSearch(item: MenuItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    item.name_pt,
    item.name_en,
    item.name_zh,
    item.item_code,
    item.category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

/** True when the dish sits on `rootId` or any descendant category. */
export function menuItemInCategorySubtree(
  item: Pick<MenuItem, 'category_id'>,
  rootId: string,
  categories: MenuCategory[],
): boolean {
  if (!item.category_id) return false;
  return collectCategorySubtreeIds(rootId, categories).includes(item.category_id);
}

/**
 * Staff recommended picker list: optional top-category chip (`null` = all)
 * plus the same name/code search as the dishes tab.
 */
export function filterRecommendedPickerItems(
  items: readonly MenuItem[],
  categories: MenuCategory[],
  topCategoryId: string | null,
  search: string,
): MenuItem[] {
  return items.filter((item) => {
    if (topCategoryId && !menuItemInCategorySubtree(item, topCategoryId, categories)) {
      return false;
    }
    return itemMatchesSearch(item, search);
  });
}
