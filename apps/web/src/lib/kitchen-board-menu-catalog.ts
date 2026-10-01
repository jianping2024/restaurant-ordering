import { isBuffetBaseItem } from '@/lib/order-items';
import type { Order, OrderItem } from '@/types';

/**
 * Thin menu_items projection for kitchen board thumbs + read-only detail.
 * Sole kitchen-board catalog shape — not a second MenuItem / customer detail model.
 */
export type KitchenBoardMenuCatalogEntry = {
  id: string;
  image_url: string | null;
  emoji: string;
  name_pt: string;
  name_en?: string | null;
  name_zh?: string | null;
  description_pt?: string;
  description_en?: string;
  description_zh?: string;
  item_code?: string | null;
  allergen_codes?: string[];
  flavor_codes?: string[];
  is_vegetarian?: boolean;
};

/** menu_item id → catalog entry for the active kitchen board. */
export type KitchenBoardMenuCatalogById = Record<string, KitchenBoardMenuCatalogEntry>;

const CATALOG_SELECT =
  'id, image_url, emoji, name_pt, name_en, name_zh, description_pt, description_en, description_zh, item_code, allergen_codes, flavor_codes, is_vegetarian';

export function kitchenBoardMenuCatalogSelect(): string {
  return CATALOG_SELECT;
}

/** Distinct non-buffet menu item ids present on kitchen board orders. */
export function collectKitchenBoardMenuItemIds(orders: Order[]): string[] {
  const ids = new Set<string>();
  for (const order of orders) {
    for (const item of order.items || []) {
      if (!item || isBuffetBaseItem(item)) continue;
      const id = (item.id || '').trim();
      if (id) ids.add(id);
    }
  }
  return Array.from(ids);
}

/** Sole mapper: menu_items rows → kitchen board catalog map. */
export function kitchenBoardMenuCatalogFromRows(
  rows: Array<
    Partial<Omit<KitchenBoardMenuCatalogEntry, 'description_pt' | 'description_en' | 'description_zh'>> & {
      id?: string | null;
      /** DB / MenuItem may send null; stored entry uses undefined. */
      description_pt?: string | null;
      description_en?: string | null;
      description_zh?: string | null;
    }
  >,
): KitchenBoardMenuCatalogById {
  const map: KitchenBoardMenuCatalogById = {};
  for (const row of rows) {
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id) continue;
    map[id] = {
      id,
      image_url:
        typeof row.image_url === 'string' && row.image_url.trim()
          ? row.image_url.trim()
          : null,
      emoji: typeof row.emoji === 'string' ? row.emoji : '',
      name_pt: typeof row.name_pt === 'string' ? row.name_pt : '',
      name_en: row.name_en ?? null,
      name_zh: row.name_zh ?? null,
      description_pt:
        typeof row.description_pt === 'string' && row.description_pt.trim()
          ? row.description_pt.trim()
          : undefined,
      description_en:
        typeof row.description_en === 'string' && row.description_en.trim()
          ? row.description_en.trim()
          : undefined,
      description_zh:
        typeof row.description_zh === 'string' && row.description_zh.trim()
          ? row.description_zh.trim()
          : undefined,
      item_code:
        typeof row.item_code === 'string' && row.item_code.trim()
          ? row.item_code.trim()
          : null,
      allergen_codes: Array.isArray(row.allergen_codes) ? row.allergen_codes : [],
      flavor_codes: Array.isArray(row.flavor_codes) ? row.flavor_codes : [],
      is_vegetarian: row.is_vegetarian === true,
    };
  }
  return map;
}

type OrderItemFallback = Pick<
  OrderItem,
  'emoji' | 'name' | 'name_pt' | 'name_en' | 'name_zh' | 'item_code'
>;

/**
 * Sole kitchen dish catalog resolve: prefer board catalog; else order-line snapshot
 * (emoji + names only — no invented description/allergens/flavors).
 */
export function resolveKitchenBoardDishCatalogEntry(input: {
  menuItemId: string;
  catalogById: KitchenBoardMenuCatalogById;
  orderItem: OrderItemFallback;
}): KitchenBoardMenuCatalogEntry {
  const fromCatalog = input.catalogById[input.menuItemId];
  if (fromCatalog) return { ...fromCatalog };

  return {
    id: input.menuItemId,
    image_url: null,
    emoji: input.orderItem.emoji || '',
    name_pt: input.orderItem.name_pt || input.orderItem.name || '',
    name_en: input.orderItem.name_en ?? null,
    name_zh: input.orderItem.name_zh ?? null,
    item_code:
      typeof input.orderItem.item_code === 'string' && input.orderItem.item_code.trim()
        ? input.orderItem.item_code.trim()
        : null,
    allergen_codes: [],
    flavor_codes: [],
    is_vegetarian: false,
  };
}

/** Build catalog map from full MenuItem-like rows (demo / tests). */
export function kitchenBoardMenuCatalogFromMenuItems(
  items: Array<{
    id: string;
    image_url?: string | null;
    emoji?: string;
    name_pt: string;
    name_en?: string | null;
    name_zh?: string | null;
    description_pt?: string | null;
    description_en?: string | null;
    description_zh?: string | null;
    item_code?: string | null;
    allergen_codes?: string[];
    flavor_codes?: string[];
    is_vegetarian?: boolean;
  }>,
  onlyIds?: ReadonlySet<string> | readonly string[],
): KitchenBoardMenuCatalogById {
  const allow =
    onlyIds == null
      ? null
      : onlyIds instanceof Set
        ? onlyIds
        : new Set(onlyIds);
  const rows = allow
    ? items.filter((item) => allow.has(item.id))
    : items;
  return kitchenBoardMenuCatalogFromRows(rows);
}
