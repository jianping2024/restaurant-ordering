/**
 * In-store takeaway ordering — sole channel + sales-role helpers.
 * Product: docs/instore-takeaway.zh.md
 */

export const TAKEAWAY_ROLES = ['none', 'sellable', 'takeaway_only', 'packaging'] as const;
export type TakeawayRole = (typeof TAKEAWAY_ROLES)[number];

export const ORDERING_CHANNELS = ['dine_in', 'takeaway'] as const;
export type OrderingChannel = (typeof ORDERING_CHANNELS)[number];

/** Editor chips: 堂食/外卖 multi-select, mutually exclusive with packaging. */
export type MenuSalesChannelSelection = {
  dineIn: boolean;
  takeaway: boolean;
  packaging: boolean;
};

export function normalizeTakeawayRole(raw: unknown): TakeawayRole {
  if (
    raw === 'sellable' ||
    raw === 'packaging' ||
    raw === 'none' ||
    raw === 'takeaway_only'
  ) {
    return raw;
  }
  return 'none';
}

export function normalizeOrderingChannel(raw: unknown): OrderingChannel {
  return raw === 'takeaway' ? 'takeaway' : 'dine_in';
}

/** Map DB role → editor chips (empty channels never returned; packaging clears both). */
export function salesChannelsFromTakeawayRole(
  role: TakeawayRole | string | null | undefined,
): MenuSalesChannelSelection {
  const r = normalizeTakeawayRole(role);
  if (r === 'packaging') return { dineIn: false, takeaway: false, packaging: true };
  if (r === 'sellable') return { dineIn: true, takeaway: true, packaging: false };
  if (r === 'takeaway_only') return { dineIn: false, takeaway: true, packaging: false };
  return { dineIn: true, takeaway: false, packaging: false };
}

/**
 * Map editor chips → DB role.
 * Packaging wins; if neither channel nor packaging → default 堂食 (`none`).
 */
export function takeawayRoleFromSalesChannels(
  sel: Pick<MenuSalesChannelSelection, 'dineIn' | 'takeaway' | 'packaging'>,
): TakeawayRole {
  if (sel.packaging) return 'packaging';
  if (sel.dineIn && sel.takeaway) return 'sellable';
  if (sel.takeaway) return 'takeaway_only';
  return 'none';
}

/** Takeaway unit price required when the dish is on the takeaway menu. */
export function takeawayRoleNeedsTakeawayPrice(role: TakeawayRole): boolean {
  return role === 'sellable' || role === 'takeaway_only';
}

export type ResolveTableOrderingChannelInput = {
  /** restaurants.feature_flags.takeaway_ordering */
  takeawayOrderingEnabled: boolean;
  /** Table belongs to the restaurant's is_takeaway group. */
  tableInTakeawayGroup: boolean;
  /** When set, always wins (session stamp). */
  sessionChannel?: OrderingChannel | string | null;
};

/**
 * Sole channel judge: session stamp if present; else flag∧group (browse / open stamp).
 * Flag off → always dine_in for no-session / new open.
 */
export function resolveTableOrderingChannel(
  input: ResolveTableOrderingChannelInput,
): OrderingChannel {
  if (input.sessionChannel != null && String(input.sessionChannel).length > 0) {
    return normalizeOrderingChannel(input.sessionChannel);
  }
  if (input.takeawayOrderingEnabled && input.tableInTakeawayGroup) {
    return 'takeaway';
  }
  return 'dine_in';
}

export type MenuItemTakeawayFields = {
  takeaway_role?: TakeawayRole | string | null;
  takeaway_price?: number | string | null;
  price: number;
  available?: boolean;
};

/** Packaging never appears on any ordering menu. */
export function isTakeawayPackagingItem(
  item: Pick<MenuItemTakeawayFields, 'takeaway_role'>,
): boolean {
  return normalizeTakeawayRole(item.takeaway_role) === 'packaging';
}

/** On takeaway ordering menu (`sellable` or `takeaway_only`). */
export function isTakeawayMenuItem(
  item: Pick<MenuItemTakeawayFields, 'takeaway_role'>,
): boolean {
  const role = normalizeTakeawayRole(item.takeaway_role);
  return role === 'sellable' || role === 'takeaway_only';
}

/** On dine-in ordering menu (`none` or `sellable`). Takeaway-only stays hidden. */
export function isDineInMenuItem(
  item: Pick<MenuItemTakeawayFields, 'takeaway_role'>,
): boolean {
  const role = normalizeTakeawayRole(item.takeaway_role);
  return role === 'none' || role === 'sellable';
}

/** Catalog visibility for a channel (after time-slot filter). */
export function menuItemVisibleForOrderingChannel(
  item: MenuItemTakeawayFields,
  channel: OrderingChannel,
): boolean {
  if (isTakeawayPackagingItem(item)) return false;
  if (channel === 'takeaway') return isTakeawayMenuItem(item);
  return isDineInMenuItem(item);
}

/** Unit price for append / display on that channel. */
export function menuItemUnitPriceForChannel(
  item: MenuItemTakeawayFields,
  channel: OrderingChannel,
): number {
  if (channel === 'takeaway' && isTakeawayMenuItem(item)) {
    const p = Number(item.takeaway_price);
    if (Number.isFinite(p) && p > 0) return p;
  }
  return Number(item.price) || 0;
}

/** Sole catalog/cart display row: same unit price as append for that channel. */
export function menuItemWithChannelDisplayPrice<T extends MenuItemTakeawayFields>(
  item: T,
  channel: OrderingChannel,
): T {
  return {
    ...item,
    price: menuItemUnitPriceForChannel(item, channel),
  };
}

export function filterMenuItemsForOrderingChannel<T extends MenuItemTakeawayFields>(
  items: readonly T[],
  channel: OrderingChannel,
): T[] {
  return items.filter((item) => menuItemVisibleForOrderingChannel(item, channel));
}
