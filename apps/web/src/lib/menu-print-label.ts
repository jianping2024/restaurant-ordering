import type { PrintLocale } from '@/lib/i18n';
import type { OrderItem } from '@/types';

export type MenuCategoryForPrint = {
  id: string;
  parent_id?: string | null;
  item_code?: string | null;
};

/** Category row with names for station ticket group headers. */
export type MenuCategoryForStationTicket = MenuCategoryForPrint & {
  name_pt: string;
  name_en?: string | null;
  name_zh?: string | null;
  sort_order?: number;
};

export type MenuItemForPrint = {
  id: string;
  category_id: string | null;
  item_code?: string | null;
};

type LocalizedMenuNames = {
  name_pt?: string | null;
  name_en?: string | null;
  name_zh?: string | null;
  /** Legacy alias often equal to name_pt on order lines. */
  name?: string | null;
};

/** Trim and cap menu/category code for storage and print. */
export function normalizeMenuItemCode(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  return s.slice(0, 10);
}

/**
 * Sole picker for printable dish/category titles from trilingual menu fields.
 * Fallback: requested locale → other locales (never prefer pt when print_locale is zh/en).
 */
export function menuLocalizedName(names: LocalizedMenuNames, locale: PrintLocale): string {
  const pt = (names.name_pt || names.name || '').trim();
  const en = (names.name_en || '').trim();
  const zh = (names.name_zh || '').trim();
  if (locale === 'zh') return zh || en || pt;
  if (locale === 'en') return en || pt || zh;
  return pt || en || zh;
}

/** Root → leaf category codes (non-empty only). */
export function categoryCodePathFromLeaf(
  leafCategoryId: string | null | undefined,
  categories: MenuCategoryForPrint[],
): string[] {
  if (!leafCategoryId) return [];
  const byId = new Map(categories.map((c) => [c.id, c]));
  const path: string[] = [];
  let current: string | null = leafCategoryId;
  const guard = new Set<string>();

  while (current && !guard.has(current)) {
    guard.add(current);
    const row = byId.get(current);
    if (!row) break;
    const code = normalizeMenuItemCode(row.item_code);
    if (code) path.push(code);
    current = row.parent_id ?? null;
  }

  return path.reverse();
}

/** `{cat}-{sub}-{itemCode}-{name}`; omits missing codes. */
export function formatMenuPrintDisplayName(params: {
  categoryPath: string[];
  itemCode: string | null;
  itemName: string;
}): string {
  const name = params.itemName.trim();
  const segments = params.categoryPath
    .map((c) => c.trim())
    .filter(Boolean);
  const itemCode = normalizeMenuItemCode(params.itemCode);
  if (itemCode) segments.push(itemCode);
  if (segments.length === 0) return name;
  return `${segments.join('-')}-${name}`;
}

/** Bill / receipt thermal line: same as station slip (`001-Água`); buffet name only. */
export function orderItemReceiptLineLabel(item: OrderItem, locale: PrintLocale): string {
  if (item.kind === 'buffet_base') {
    return menuLocalizedName(item, locale);
  }
  return orderItemStationSlipLabel(item, locale);
}

/** Station slip item line: `{itemCode}-{name}` only (no category path). */
export function formatStationSlipItemLabel(params: {
  itemCode: string | null | undefined;
  itemName: string;
}): string {
  const name = params.itemName.trim();
  const code = normalizeMenuItemCode(params.itemCode);
  if (code && name) return `${code}-${name}`;
  if (code) return code;
  return name;
}

export function orderItemStationSlipLabel(
  item: Pick<OrderItem, 'item_code' | 'name_pt' | 'name' | 'name_en' | 'name_zh'>,
  locale: PrintLocale,
): string {
  return formatStationSlipItemLabel({
    itemCode: item.item_code ?? null,
    itemName: menuLocalizedName(item, locale),
  });
}

/** Root (top-level) category id for grouping station tickets. */
export function topLevelCategoryId(
  leafCategoryId: string | null | undefined,
  categories: MenuCategoryForPrint[],
): string | null {
  if (!leafCategoryId) return null;
  const byId = new Map(categories.map((c) => [c.id, c]));
  let current: string | null = leafCategoryId;
  const guard = new Set<string>();
  let topId: string | null = null;
  while (current && !guard.has(current)) {
    guard.add(current);
    topId = current;
    const row = byId.get(current);
    if (!row) break;
    current = row.parent_id ?? null;
  }
  return topId;
}

/** `(Drinks)` / `(饮料2)` — single name for ticket locale + optional category code. */
export function formatTopCategoryTicketHeader(
  cat: Pick<MenuCategoryForStationTicket, 'item_code' | 'name_pt' | 'name_en' | 'name_zh'>,
  locale: PrintLocale,
): string {
  const code = normalizeMenuItemCode(cat.item_code);
  let inner = menuLocalizedName(cat, locale);
  if (code) {
    inner = `${inner}${code}`;
  }
  return `(${inner})`;
}
