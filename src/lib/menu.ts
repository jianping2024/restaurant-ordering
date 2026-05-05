import type { Category, Language, MenuItem } from '@/types';

export const MENU_CATEGORIES: Category[] = ['Entradas', 'Pratos', 'Bebidas', 'Sobremesas'];
export const CATEGORY_PATH_SEPARATOR = ' / ';

export function normalizeCategoryPath(input: string): string {
  const parts = input
    .split(/[>/]/g)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.join(CATEGORY_PATH_SEPARATOR);
}

export function splitCategoryPath(category: string): string[] {
  const normalized = normalizeCategoryPath(category);
  return normalized ? normalized.split(CATEGORY_PATH_SEPARATOR) : [];
}

export interface MenuCategoryTree {
  topCategories: string[];
  subpathsByTop: Record<string, string[]>;
}

export function buildMenuCategoryTree(categories: string[]): MenuCategoryTree {
  const topSet = new Set<string>();
  const subpathsByTop = new Map<string, Set<string>>();

  categories.forEach((rawCategory) => {
    const levels = splitCategoryPath(rawCategory);
    if (levels.length === 0) return;
    const top = levels[0];
    topSet.add(top);
    if (!subpathsByTop.has(top)) subpathsByTop.set(top, new Set<string>());
    const subpath = levels.slice(1).join(CATEGORY_PATH_SEPARATOR);
    subpathsByTop.get(top)!.add(subpath);
  });

  const topCategories = Array.from(topSet);
  const sortedSubpathsByTop: Record<string, string[]> = {};
  topCategories.forEach((top) => {
    sortedSubpathsByTop[top] = Array.from(subpathsByTop.get(top) || new Set([''])).sort((a, b) => {
      if (a === '') return -1;
      if (b === '') return 1;
      return a.localeCompare(b);
    });
  });

  return {
    topCategories,
    subpathsByTop: sortedSubpathsByTop,
  };
}

export function getLocalizedCategoryPath(item: MenuItem, lang: Language): string {
  if (lang === 'en') return normalizeCategoryPath(item.category_en || item.category);
  if (lang === 'zh') return normalizeCategoryPath(item.category_zh || item.category);
  return normalizeCategoryPath(item.category);
}

export function buildLocalizedCategoryLookup(items: MenuItem[], lang: Language): Record<string, string> {
  const map: Record<string, string> = {};
  items.forEach((item) => {
    const canonical = normalizeCategoryPath(item.category);
    if (!canonical) return;
    const localized = getLocalizedCategoryPath(item, lang);
    if (!map[canonical]) map[canonical] = localized || canonical;
  });
  return map;
}
