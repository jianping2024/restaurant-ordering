import { normalizeMenuItemCode } from '@/lib/menu-print-label';
import type { Language, MenuItem } from '@/types';

export type MenuItemNameFields = Pick<MenuItem, 'name_pt' | 'name_en' | 'name_zh'>;

/** Locale-aware dish name for customer ordering surfaces (menu list, cart). */
export function resolveMenuItemLocalizedName(item: MenuItemNameFields, lang: Language): string {
  if (lang === 'zh') return (item.name_zh || item.name_pt || '').trim();
  if (lang === 'en') return (item.name_en || item.name_pt || '').trim();
  return (item.name_pt || '').trim();
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

/** Catalog card / list title for a menu row. */
export function formatMenuCatalogItemLabel(item: MenuItem, lang: Language): string {
  return formatOnScreenMenuItemLabel(
    resolveMenuItemLocalizedName(item, lang),
    item.item_code,
  );
}

/** Cart drawer line — same label rules as catalog; code from live menu lookup. */
export function formatCartMenuLineLabel(
  item: MenuItemNameFields,
  lang: Language,
  itemCode: string | null | undefined,
): string {
  return formatOnScreenMenuItemLabel(resolveMenuItemLocalizedName(item, lang), itemCode);
}
