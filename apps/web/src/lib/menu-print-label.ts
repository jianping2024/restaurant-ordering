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

/** Trim and cap menu/category code for storage and print. */
export function normalizeMenuItemCode(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  return s.slice(0, 10);
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

export function orderItemBaseName(
  item: Pick<OrderItem, 'name_pt' | 'name' | 'name_en' | 'name_zh'>,
): string {
  return (item.name_pt || item.name || item.name_en || item.name_zh || '').trim();
}

/** Receipt / station slip line from order snapshot: `RE-001-Água 500ml`. */
export function orderItemReceiptLineLabel(item: OrderItem): string {
  return formatMenuPrintDisplayName({
    categoryPath: item.category_code_path ?? [],
    itemCode: item.item_code ?? null,
    itemName: orderItemBaseName(item),
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

/** `(Bebidas/ Drinks2)` style; prefixes top-level category code when set. */
export function formatTopCategoryTicketHeader(
  cat: Pick<MenuCategoryForStationTicket, 'item_code' | 'name_pt' | 'name_en' | 'name_zh'>,
  locale: 'zh' | 'en' | 'pt',
): string {
  const code = normalizeMenuItemCode(cat.item_code);
  const pt = (cat.name_pt || '').trim();
  const en = (cat.name_en || '').trim();
  const zh = (cat.name_zh || '').trim();

  let primary = pt;
  let secondary = en || zh;
  if (locale === 'zh') {
    primary = zh || en || pt;
    secondary = en || pt;
  } else if (locale === 'en') {
    primary = en || pt || zh;
    secondary = pt;
  } else {
    primary = pt || en || zh;
    secondary = en || zh;
  }
  if (!secondary || secondary === primary) {
    secondary = '';
  }

  let inner = primary;
  if (secondary) {
    inner = `${primary}/ ${secondary}`;
  }
  if (code) {
    inner = `${code}-${inner}`;
  }
  return `(${inner})`;
}
