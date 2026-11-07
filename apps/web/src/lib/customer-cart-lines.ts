import { coerceCartPrice } from '@/lib/cart-totals';
import { mintBrowserUuid } from '@/lib/browser-uuid';
import { cartConfigIdentityKey } from '@/lib/menu-dish-order-config';
import type { MenuToppingPick } from '@/lib/menu-topping-binding';
import type { TablePriced } from '@/lib/instore-takeaway';
import type { CartItem, MenuItem } from '@/types';

/** Cart lines price only from rows already priced for this table. */
type PricedMenuItem = TablePriced<MenuItem>;

export type CartLineConfig = {
  choicePicks?: Readonly<Record<string, string>>;
  toppingPicks?: readonly { menuItemId: string; qty: number }[];
  note?: string;
  selectedNotePresetIds?: readonly string[];
};

function toToppingPicksWire(
  picks: readonly { menuItemId: string; qty: number }[] | undefined,
): MenuToppingPick[] {
  return (picks ?? [])
    .filter((p) => p.qty > 0)
    .map((p) => ({ menu_item_id: p.menuItemId, qty: p.qty }));
}

/** Sole cart-line config fingerprint (dish + choices + toppings + notes). */
export function cartLineIdentityKey(line: {
  menuItemId: string;
  choicePicks?: Readonly<Record<string, string>>;
  toppingPicks?: readonly { menuItemId: string; qty: number }[];
  note?: string;
  selectedNotePresetIds?: readonly string[];
}): string {
  return cartConfigIdentityKey({
    menuItemId: line.menuItemId,
    choicePicks: line.choicePicks ?? {},
    toppingPicks: toToppingPicksWire(line.toppingPicks),
    note: line.note ?? '',
    selectedNotePresetIds: line.selectedNotePresetIds ?? [],
  });
}

function emptyConfig(): CartLineConfig {
  return {
    choicePicks: {},
    toppingPicks: [],
    note: '',
    selectedNotePresetIds: [],
  };
}

/** Unit price = main + Σ(topping unit × topping qty); every row is table-priced. */
export function cartLineUnitPrice(
  item: PricedMenuItem,
  toppingPicks: readonly { menuItemId: string; qty: number }[] | undefined,
  allItems: readonly PricedMenuItem[],
): number {
  let sum = coerceCartPrice(item.price);
  for (const t of toppingPicks ?? []) {
    if (!(t.qty > 0)) continue;
    const dish = allItems.find((d) => d.id === t.menuItemId);
    if (dish) sum += coerceCartPrice(dish.price) * t.qty;
  }
  return sum;
}

/**
 * Re-derive cart line prices from the table-priced catalog (buffet switched / menu edited).
 * Returns the same array when nothing changed; dishes missing from the catalog keep their price.
 */
export function repriceCartLines(
  cart: CartItem[],
  allItems: readonly PricedMenuItem[],
): CartItem[] {
  let changed = false;
  const next = cart.map((line) => {
    const item = allItems.find((d) => d.id === line.menuItemId);
    if (!item) return line;
    const price = cartLineUnitPrice(item, line.toppingPicks, allItems);
    if (price === line.price) return line;
    changed = true;
    return { ...line, price };
  });
  return changed ? next : cart;
}

function buildCartLine(
  item: PricedMenuItem,
  qty: number,
  config: CartLineConfig,
  allItems: readonly PricedMenuItem[] = [],
  lineId?: string,
): CartItem {
  const toppingPicks = (config.toppingPicks ?? [])
    .filter((t) => t.qty > 0)
    .map((t) => ({ menuItemId: t.menuItemId, qty: t.qty }));
  return {
    lineId: lineId ?? mintBrowserUuid(),
    menuItemId: item.id,
    name_pt: item.name_pt,
    name_en: item.name_en,
    name_zh: item.name_zh,
    price: cartLineUnitPrice(item, toppingPicks, allItems),
    emoji: item.emoji,
    qty,
    note: config.note ?? '',
    notePresetGroupIds: item.note_preset_group_ids || [],
    selectedNotePresetIds: [...(config.selectedNotePresetIds ?? [])],
    choicePicks: { ...(config.choicePicks ?? {}) },
    toppingPicks,
  };
}

/**
 * Sole pure cart-line qty write for plain list ± (empty config identity).
 * nextQty ≤ 0 removes the empty-config line for this dish.
 */
export function upsertCartItemQty(
  prev: readonly CartItem[],
  item: PricedMenuItem,
  nextQty: number,
): CartItem[] {
  const emptyKey = cartLineIdentityKey({
    menuItemId: item.id,
    ...emptyConfig(),
  });
  if (!Number.isFinite(nextQty) || nextQty <= 0) {
    return prev.filter((c) => cartLineIdentityKey(c) !== emptyKey);
  }
  const existing = prev.find((c) => cartLineIdentityKey(c) === emptyKey);
  if (!existing) {
    return [...prev, buildCartLine(item, nextQty, emptyConfig())];
  }
  return prev.map((c) =>
    cartLineIdentityKey(c) === emptyKey ? { ...c, qty: nextQty } : c,
  );
}

/** Add/merge one configured (or plain) line by full identity; deltaQty usually +1. */
export function upsertCartLineByConfig(
  prev: readonly CartItem[],
  item: PricedMenuItem,
  config: CartLineConfig,
  deltaQty: number,
  allItems: readonly PricedMenuItem[] = [],
): CartItem[] {
  if (!Number.isFinite(deltaQty) || deltaQty === 0) return [...prev];
  const key = cartLineIdentityKey({
    menuItemId: item.id,
    choicePicks: config.choicePicks ?? {},
    toppingPicks: config.toppingPicks ?? [],
    note: config.note ?? '',
    selectedNotePresetIds: config.selectedNotePresetIds ?? [],
  });
  const idx = prev.findIndex((c) => cartLineIdentityKey(c) === key);
  if (idx < 0) {
    if (deltaQty < 0) return [...prev];
    return [...prev, buildCartLine(item, deltaQty, config, allItems)];
  }
  const next = [...prev];
  const line = next[idx]!;
  const qty = line.qty + deltaQty;
  if (qty <= 0) {
    next.splice(idx, 1);
    return next;
  }
  next[idx] = { ...line, qty };
  return next;
}

/** Set qty for a specific cart line id (cart drawer / configured bump). */
export function setCartLineQtyByLineId(
  prev: readonly CartItem[],
  lineId: string,
  nextQty: number,
): CartItem[] {
  if (!Number.isFinite(nextQty) || nextQty <= 0) {
    return prev.filter((c) => c.lineId !== lineId);
  }
  return prev.map((c) => (c.lineId === lineId ? { ...c, qty: nextQty } : c));
}

export function updateCartLineNoteByLineId(
  prev: readonly CartItem[],
  lineId: string,
  note: string,
): CartItem[] {
  return prev.map((c) => (c.lineId === lineId ? { ...c, note } : c));
}

export function updateCartLineNotePresetsByLineId(
  prev: readonly CartItem[],
  lineId: string,
  selectedNotePresetIds: string[],
): CartItem[] {
  return prev.map((c) =>
    c.lineId === lineId ? { ...c, selectedNotePresetIds } : c,
  );
}
