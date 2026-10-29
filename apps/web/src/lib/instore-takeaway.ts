/**
 * In-store takeaway ordering — sole channel + sales-role helpers.
 * Product: docs/instore-takeaway.zh.md
 */

export const TAKEAWAY_ROLES = ['none', 'sellable', 'packaging'] as const;
export type TakeawayRole = (typeof TAKEAWAY_ROLES)[number];

export const ORDERING_CHANNELS = ['dine_in', 'takeaway'] as const;
export type OrderingChannel = (typeof ORDERING_CHANNELS)[number];

export function normalizeTakeawayRole(raw: unknown): TakeawayRole {
  if (raw === 'sellable' || raw === 'packaging' || raw === 'none') return raw;
  return 'none';
}

export function normalizeOrderingChannel(raw: unknown): OrderingChannel {
  return raw === 'takeaway' ? 'takeaway' : 'dine_in';
}

/** UI sales-mode label key mapping (none → dine-in only). */
export function takeawayRoleFromSalesMode(
  mode: 'dine_in' | 'sellable' | 'packaging',
): TakeawayRole {
  if (mode === 'sellable') return 'sellable';
  if (mode === 'packaging') return 'packaging';
  return 'none';
}

export function salesModeFromTakeawayRole(
  role: TakeawayRole,
): 'dine_in' | 'sellable' | 'packaging' {
  if (role === 'sellable') return 'sellable';
  if (role === 'packaging') return 'packaging';
  return 'dine_in';
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

export function isTakeawaySellableItem(
  item: Pick<MenuItemTakeawayFields, 'takeaway_role'>,
): boolean {
  return normalizeTakeawayRole(item.takeaway_role) === 'sellable';
}

/** Catalog visibility for a channel (after time-slot filter). */
export function menuItemVisibleForOrderingChannel(
  item: MenuItemTakeawayFields,
  channel: OrderingChannel,
): boolean {
  if (isTakeawayPackagingItem(item)) return false;
  if (channel === 'takeaway') return isTakeawaySellableItem(item);
  return true;
}

/** Unit price for append / display on that channel. */
export function menuItemUnitPriceForChannel(
  item: MenuItemTakeawayFields,
  channel: OrderingChannel,
): number {
  if (channel === 'takeaway' && isTakeawaySellableItem(item)) {
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
