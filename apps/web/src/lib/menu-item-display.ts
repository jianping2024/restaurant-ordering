import { normalizeMenuItemCode } from '@/lib/menu-print-label';
import type { Language, MenuItem } from '@/types';

export type MenuItemNameFields = Pick<MenuItem, 'name_pt' | 'name_en' | 'name_zh'>;
export type MenuItemDescriptionFields = Pick<
  MenuItem,
  'description_pt' | 'description_en' | 'description_zh'
>;

/** Locale-aware dish name for customer ordering surfaces (menu list, cart). */
export function resolveMenuItemLocalizedName(item: MenuItemNameFields, lang: Language): string {
  if (lang === 'zh') return (item.name_zh || item.name_pt || '').trim();
  if (lang === 'en') return (item.name_en || item.name_pt || '').trim();
  return (item.name_pt || '').trim();
}

/** Locale-aware dish description for customer menu cards. */
export function resolveMenuItemLocalizedDescription(
  item: MenuItemDescriptionFields,
  lang: Language,
): string | undefined {
  const text =
    lang === 'zh'
      ? item.description_zh || item.description_en || item.description_pt
      : lang === 'en'
        ? item.description_en || item.description_pt
        : item.description_pt;
  const trimmed = text?.trim();
  return trimmed || undefined;
}

/** On-screen menu line: `001 Água 500ml`; omits code when missing. */
export function formatOnScreenMenuItemLabel(
  localizedName: string,
  itemCode: string | null | undefined,
): string {
  const name = localizedName.trim();
  const code = normalizeMenuItemCode(itemCode);
  if (code && name) return `${code} ${name}`;
  if (code) return code;
  return name;
}

/** Localized catalog/cart line with optional item code override (cart lookup). */
export function formatLocalizedMenuItemLabel(
  item: MenuItemNameFields,
  lang: Language,
  itemCode?: string | null,
): string {
  return formatOnScreenMenuItemLabel(
    resolveMenuItemLocalizedName(item, lang),
    itemCode,
  );
}

/** Catalog card / list title for a menu row. */
export function formatMenuCatalogItemLabel(item: MenuItem, lang: Language): string {
  return formatLocalizedMenuItemLabel(item, lang, item.item_code);
}
