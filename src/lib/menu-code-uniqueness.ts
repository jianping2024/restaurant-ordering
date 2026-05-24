import { normalizeMenuItemCode } from '@/lib/menu-print-label';
import type { MenuCategory, MenuItem } from '@/types';

/** Case-insensitive key for duplicate checks; empty codes do not conflict. */
export function menuCodeKey(raw: string | null | undefined): string | null {
  const normalized = normalizeMenuItemCode(raw);
  return normalized ? normalized.toLowerCase() : null;
}

export function siblingCategoryHasDuplicateCode(
  categories: MenuCategory[],
  parentId: string | null,
  code: string | null | undefined,
  excludeCategoryId?: string,
): boolean {
  const key = menuCodeKey(code);
  if (!key) return false;
  return categories.some((c) => {
    if (excludeCategoryId && c.id === excludeCategoryId) return false;
    if ((c.parent_id || null) !== parentId) return false;
    return menuCodeKey(c.item_code) === key;
  });
}

export function menuItemHasDuplicateCode(
  items: MenuItem[],
  code: string | null | undefined,
  excludeItemId?: string,
): boolean {
  const key = menuCodeKey(code);
  if (!key) return false;
  return items.some((item) => {
    if (excludeItemId && item.id === excludeItemId) return false;
    return menuCodeKey(item.item_code) === key;
  });
}

export function isPostgresUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505';
}
