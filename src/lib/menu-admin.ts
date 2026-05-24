import type { MenuCategory, MenuItem } from '@/types';
import type { UILanguage } from '@/lib/i18n';
import { categoryCodePathFromLeaf, formatMenuPrintDisplayName } from '@/lib/menu-print-label';

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
