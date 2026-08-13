import { normalizeMenuItemCode } from '@/lib/menu-print-label';
import type { Language, MenuItem } from '@/types';

/** Catalog row or order-line snapshot. Print titles use `menuLocalizedName` instead. */
export type MenuItemNameFields = {
  name_pt?: string | null;
  name_en?: string | null;
  name_zh?: string | null;
  /** Legacy order-line snapshot; treated as Portuguese when `name_pt` is empty. */
  name?: string | null;
};
export type MenuItemDescriptionFields = Pick<
  MenuItem,
  'description_pt' | 'description_en' | 'description_zh'
>;

/** Sole on-screen dish name picker (catalog, cart, ordered list, bill, floor, kitchen). */
export function resolveMenuItemLocalizedName(item: MenuItemNameFields, lang: Language): string {
  const pt = (item.name_pt || item.name || '').trim();
  const en = (item.name_en || '').trim();
  const zh = (item.name_zh || '').trim();
  if (lang === 'zh') return zh || pt;
  if (lang === 'en') return en || pt;
  return pt;
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
