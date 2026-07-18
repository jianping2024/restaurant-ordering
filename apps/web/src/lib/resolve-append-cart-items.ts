import type { SupabaseClient } from '@supabase/supabase-js';
import { coerceCartPrice, coerceCartQty } from '@/lib/cart-totals';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import {
  categoryCodePathFromLeaf,
  type MenuCategoryForPrint,
} from '@/lib/menu-print-label';
import type { OrderItem } from '@/types';
import {
  APPEND_CART_MAX_LINES,
  APPEND_CART_QTY_MAX,
  APPEND_CART_QTY_MIN,
  clampAppendCartNote,
} from '@/types';

export type ResolveAppendCartError =
  | 'invalid_items'
  | 'menu_item_not_found'
  | 'menu_item_unavailable';

export type ResolveAppendCartSuccess = {
  ok: true;
  items: OrderItem[];
  batchId: string;
};

export type ResolveAppendCartFailure = {
  ok: false;
  error: ResolveAppendCartError;
};

export type ResolveAppendCartResult = ResolveAppendCartSuccess | ResolveAppendCartFailure;

type MenuItemRow = {
  id: string;
  category_id: string | null;
  name_pt: string;
  name_en: string | null;
  name_zh: string | null;
  price: unknown;
  emoji: string | null;
  available: boolean;
  item_code: string | null;
};

export type ParsedAppendCartLine = {
  menuItemId: string;
  qty: number;
  note: string;
};

/** Same shape as MenuPage submit batches. */
export function generateAppendBatchId(nowMs = Date.now()): string {
  return `${nowMs}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeNotes(a: string, b: string): string {
  if (!a) return b;
  if (!b || a === b) return a;
  return clampAppendCartNote(`${a}; ${b}`);
}

const FORBIDDEN_APPEND_LINE_KEYS = [
  'id',
  'name',
  'name_pt',
  'name_en',
  'name_zh',
  'price',
  'emoji',
  'batch_id',
  'added_at',
  'item_status',
  'kind',
  'buffet_id',
  'adult_count',
  'child_count',
  'adult_unit_price',
  'child_unit_price',
  'price_rule_id',
  'item_code',
  'category_code_path',
] as const;

function parseMenuItemId(row: Record<string, unknown>): string | null {
  if (typeof row.menu_item_id !== 'string') return null;
  const t = row.menu_item_id.trim();
  if (t.toLowerCase().startsWith('buffet:')) return null;
  return parseTableIdParam(t);
}

function rowHasForbiddenClientFields(row: Record<string, unknown>): boolean {
  return FORBIDDEN_APPEND_LINE_KEYS.some((key) => key in row);
}

function rowLooksLikeBuffet(row: Record<string, unknown>): boolean {
  if (row.kind === 'buffet_base') return true;
  const v = row.menu_item_id;
  return typeof v === 'string' && v.trim().toLowerCase().startsWith('buffet:');
}

/** Validate and merge raw append `items` (`AppendCartLineInput` only). */
export function parseAppendCartRawItems(
  raw: unknown,
): { ok: true; lines: ParsedAppendCartLine[] } | ResolveAppendCartFailure {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > APPEND_CART_MAX_LINES) {
    return { ok: false, error: 'invalid_items' };
  }

  const merged = new Map<string, ParsedAppendCartLine>();
  const order: string[] = [];

  for (const row of raw) {
    if (!row || typeof row !== 'object') {
      return { ok: false, error: 'invalid_items' };
    }
    const r = row as Record<string, unknown>;
    if (rowHasForbiddenClientFields(r) || rowLooksLikeBuffet(r)) {
      return { ok: false, error: 'invalid_items' };
    }

    const menuItemId = parseMenuItemId(r);
    if (!menuItemId) {
      return { ok: false, error: 'invalid_items' };
    }

    const qty = coerceCartQty(r.qty);
    if (qty < APPEND_CART_QTY_MIN || qty > APPEND_CART_QTY_MAX) {
      return { ok: false, error: 'invalid_items' };
    }

    const note =
      typeof r.note === 'string' ? clampAppendCartNote(r.note.trim()) : '';

    const existing = merged.get(menuItemId);
    if (existing) {
      const nextQty = existing.qty + qty;
      if (nextQty > APPEND_CART_QTY_MAX) {
        return { ok: false, error: 'invalid_items' };
      }
      existing.qty = nextQty;
      existing.note = mergeNotes(existing.note, note);
    } else {
      merged.set(menuItemId, { menuItemId, qty, note });
      order.push(menuItemId);
    }
  }

  const lines = order.map((id) => merged.get(id)!);
  return { ok: true, lines };
}

/** Walk parent chain from cart item categories only — not the full menu tree. */
async function loadCategoriesForLeafIds(
  admin: SupabaseClient,
  restaurantId: string,
  leafIds: Array<string | null>,
): Promise<MenuCategoryForPrint[]> {
  const byId = new Map<string, MenuCategoryForPrint>();
  let frontier = Array.from(new Set(leafIds.filter((id): id is string => !!id)));
  const seen = new Set<string>();

  while (frontier.length > 0) {
    const ids = frontier.filter((id) => !seen.has(id));
    if (ids.length === 0) break;
    for (const id of ids) seen.add(id);

    const { data, error } = await admin
      .from('menu_categories')
      .select('id, parent_id, item_code')
      .eq('restaurant_id', restaurantId)
      .in('id', ids);

    if (error) throw new Error('menu_categories_query_failed');

    const nextFrontier: string[] = [];
    for (const row of data || []) {
      const cat = row as MenuCategoryForPrint;
      byId.set(cat.id, cat);
      if (cat.parent_id && !seen.has(cat.parent_id)) {
        nextFrontier.push(cat.parent_id);
      }
    }
    frontier = nextFrontier;
  }

  return Array.from(byId.values());
}

function menuRowToOrderItem(
  menu: MenuItemRow,
  line: ParsedAppendCartLine,
  batchId: string,
  addedAt: string,
  categories: MenuCategoryForPrint[],
): OrderItem {
  const name_pt = (menu.name_pt || '').trim() || '—';
  return {
    id: menu.id,
    name: name_pt,
    name_pt,
    name_en: menu.name_en ?? undefined,
    name_zh: menu.name_zh ?? undefined,
    qty: line.qty,
    note: line.note,
    price: coerceCartPrice(menu.price),
    emoji: typeof menu.emoji === 'string' && menu.emoji ? menu.emoji.slice(0, 8) : '🍽️',
    item_code: menu.item_code?.trim() || null,
    category_code_path: categoryCodePathFromLeaf(menu.category_id, categories),
    item_status: 'pending',
    batch_id: batchId,
    added_at: addedAt,
  };
}

/**
 * Resolve trusted append cart lines to {@link OrderItem} rows using menu DB prices.
 */
export async function resolveAppendCartItems(params: {
  admin: SupabaseClient;
  restaurantId: string;
  rawItems: unknown;
  batchId?: string;
  addedAt?: string;
}): Promise<ResolveAppendCartResult> {
  const parsed = parseAppendCartRawItems(params.rawItems);
  if (!parsed.ok) return parsed;

  const { lines } = parsed;
  const ids = lines.map((l) => l.menuItemId);

  const { data, error } = await params.admin
    .from('menu_items')
    .select('id, category_id, name_pt, name_en, name_zh, price, emoji, available, item_code')
    .eq('restaurant_id', params.restaurantId)
    .in('id', ids);

  if (error) {
    throw new Error('menu_items_query_failed');
  }

  const leafIds = (data || []).map((row) => row.category_id as string | null);
  const categories = await loadCategoriesForLeafIds(params.admin, params.restaurantId, leafIds);
  const byId = new Map<string, MenuItemRow>();
  for (const row of data || []) {
    byId.set(row.id as string, row as MenuItemRow);
  }

  const batchId = params.batchId ?? generateAppendBatchId();
  const addedAt = params.addedAt ?? new Date().toISOString();
  const items: OrderItem[] = [];

  for (const line of lines) {
    const menu = byId.get(line.menuItemId);
    if (!menu) {
      return { ok: false, error: 'menu_item_not_found' };
    }
    if (!menu.available) {
      return { ok: false, error: 'menu_item_unavailable' };
    }
    items.push(menuRowToOrderItem(menu, line, batchId, addedAt, categories));
  }

  return { ok: true, items, batchId };
}
