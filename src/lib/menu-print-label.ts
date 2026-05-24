import type { OrderItem } from '@/types';

export type MenuCategoryForPrint = {
  id: string;
  parent_id: string | null;
  item_code?: string | null;
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

export function orderItemPrintDisplayName(
  item: OrderItem,
  menuById: Map<string, MenuItemForPrint>,
  categories: MenuCategoryForPrint[],
): string {
  const base = (item.name_pt || item.name || item.name_en || item.name_zh || '').trim();
  const row = menuById.get(item.id);
  if (!row) return base;
  const categoryPath = categoryCodePathFromLeaf(row.category_id, categories);
  return formatMenuPrintDisplayName({
    categoryPath,
    itemCode: row.item_code ?? null,
    itemName: base,
  });
}
