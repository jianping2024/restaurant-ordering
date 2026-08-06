import type { Order } from '@/types';
import { aggregateBuffetHeadcountForOrders, totalGuestsFromCounts } from '@/lib/buffet-order';
import { isSushiBuffetMode } from '@mesa/shared';
import { normalizeOrderItemStatus } from '@/lib/order-status';

export type SushiLimitMenuFields = {
  per_person_qty_limit?: number | null;
  over_limit_unit_price?: number | null;
};

/** Adults + children across all active buffet packages (0 if none / all zero). */
export function sessionGuestCountForLimits(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): number {
  return totalGuestsFromCounts(aggregateBuffetHeadcountForOrders(orders));
}

/** Non-voided menu line qty for one menu_item id in the session. */
export function sessionOrderedQtyForMenuItem(
  orders: Array<Pick<Order, 'items' | 'status'>>,
  menuItemId: string,
): number {
  return sumSessionMenuItemQty(orders, menuItemId, () => true);
}

/** Non-voided menu line (excludes buffet_base). Single predicate for session + settlement. */
export function isActiveSessionMenuLine(
  item: NonNullable<Order['items']>[number],
  orderStatus: Order['status'],
): boolean {
  if (item.kind === 'buffet_base') return false;
  return normalizeOrderItemStatus(item, orderStatus) !== 'voided';
}

function forEachActiveSessionMenuLine(
  orders: Array<Pick<Order, 'items' | 'status'>>,
  visit: (item: NonNullable<Order['items']>[number]) => void,
): void {
  for (const order of orders) {
    for (const item of order.items || []) {
      if (!isActiveSessionMenuLine(item, order.status)) continue;
      visit(item);
    }
  }
}

function sumSessionMenuItemQty(
  orders: Array<Pick<Order, 'items' | 'status'>>,
  menuItemId: string,
  includeLine: (item: NonNullable<Order['items']>[number]) => boolean,
): number {
  let total = 0;
  forEachActiveSessionMenuLine(orders, (item) => {
    if (item.id !== menuItemId) return;
    if (!includeLine(item)) return;
    const qty = Number(item.qty);
    if (Number.isFinite(qty) && qty > 0) total += qty;
  });
  return total;
}

/** Per-person free allowance when the item is limited (null when unlimited). */
function perPersonLimitOf(item: SushiLimitMenuFields): number | null {
  const limit = item.per_person_qty_limit;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1) return null;
  return limit;
}

/** Overage unit price when valid (null when missing/invalid). */
function overLimitUnitPriceOf(item: SushiLimitMenuFields): number | null {
  const price = item.over_limit_unit_price;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return null;
  return price;
}

export function isLimitedSushiMenuItem(
  serviceMode: unknown,
  item: SushiLimitMenuFields,
): boolean {
  if (!isSushiBuffetMode(serviceMode)) return false;
  return perPersonLimitOf(item) !== null;
}

/** Free (included) allowance for the table: per-person × guest count. */
export function freeAllowanceQty(perPersonLimit: number, guestCount: number): number {
  if (perPersonLimit < 1 || guestCount < 1) return 0;
  return perPersonLimit * guestCount;
}

export function freeRemainingQty(params: {
  perPersonLimit: number;
  guestCount: number;
  alreadyOrdered: number;
}): number {
  const free = freeAllowanceQty(params.perPersonLimit, params.guestCount);
  return Math.max(0, free - Math.max(0, params.alreadyOrdered));
}

export type SushiLimitSplit = {
  includedQty: number;
  overageQty: number;
};

/** Split a requested qty into included vs overage given remaining free slots. */
export function splitQtyAgainstFreeRemaining(
  requestQty: number,
  freeRemaining: number,
): SushiLimitSplit {
  const qty = Math.max(0, requestQty);
  const free = Math.max(0, freeRemaining);
  const includedQty = Math.min(qty, free);
  return { includedQty, overageQty: qty - includedQty };
}

export type SushiLimitError =
  | 'limited_item_requires_headcount'
  | 'per_person_limit_exceeded'
  | 'over_limit_price_missing';

export type SushiLimitCheckResult = { ok: true } | { ok: false; error: SushiLimitError };

/** Headcount + overage price gate shared by the order gate and the staff overage preview. */
function assertLimitedSushiReady(
  guestCount: number,
  item: SushiLimitMenuFields,
): { ok: true; overLimitUnitPrice: number } | { ok: false; error: SushiLimitError } {
  if (guestCount < 1) {
    return { ok: false, error: 'limited_item_requires_headcount' };
  }
  const overPrice = overLimitUnitPriceOf(item);
  if (overPrice === null) {
    return { ok: false, error: 'over_limit_price_missing' };
  }
  return { ok: true, overLimitUnitPrice: overPrice };
}

/**
 * Order-time gate for one cart line. Limited dishes are always stored at menu price;
 * the chargeable share is derived from the table allowance when the bill is built.
 * Guest: hard-capped at the free allowance. Staff: may exceed after confirming.
 */
export function checkSushiLimitForCartLine(params: {
  serviceMode: unknown;
  staffAssisted: boolean;
  guestCount: number;
  alreadyOrdered: number;
  requestQty: number;
  item: SushiLimitMenuFields;
}): SushiLimitCheckResult {
  if (params.requestQty <= 0) return { ok: true };
  if (!isLimitedSushiMenuItem(params.serviceMode, params.item)) return { ok: true };

  const ready = assertLimitedSushiReady(params.guestCount, params.item);
  if (!ready.ok) return ready;
  if (params.staffAssisted) return { ok: true };

  const freeRemaining = freeRemainingQty({
    perPersonLimit: params.item.per_person_qty_limit!,
    guestCount: params.guestCount,
    alreadyOrdered: params.alreadyOrdered,
  });
  const { overageQty } = splitQtyAgainstFreeRemaining(params.requestQty, freeRemaining);
  if (overageQty > 0) {
    return { ok: false, error: 'per_person_limit_exceeded' };
  }
  return { ok: true };
}

export type SushiLimitedLineAllocation = {
  freeQty: number;
  chargeableQty: number;
  chargeableUnitPrice: number;
};

/** Identifies one physical order line inside {@link allocateSessionSushiLimitedLines}. */
export function sushiLimitedLineKey(orderId: string, itemIdx: number): string {
  return `${orderId}#${itemIdx}`;
}

/**
 * Spread the table's free allowance across the session's limited lines (oldest first)
 * and mark the remainder chargeable. Lines carry their own rule snapshot, so billing
 * needs neither the menu catalog nor the restaurant service mode.
 */
export function allocateSessionSushiLimitedLines(
  orders: Array<Pick<Order, 'id' | 'items' | 'status'>>,
): Map<string, SushiLimitedLineAllocation> {
  const allocations = new Map<string, SushiLimitedLineAllocation>();
  const rows: Array<{
    key: string;
    sortKey: string;
    menuItemId: string;
    qty: number;
    perPersonLimit: number;
    chargeableUnitPrice: number;
  }> = [];

  for (const order of orders) {
    const items = order.items || [];
    for (let itemIdx = 0; itemIdx < items.length; itemIdx += 1) {
      const item = items[itemIdx];
      if (!item || !isActiveSessionMenuLine(item, order.status)) continue;
      const perPersonLimit = perPersonLimitOf(item);
      const chargeableUnitPrice = overLimitUnitPriceOf(item);
      if (perPersonLimit === null || chargeableUnitPrice === null) continue;
      rows.push({
        key: sushiLimitedLineKey(order.id, itemIdx),
        sortKey: `${item.added_at ?? ''}#${order.id}#${String(itemIdx).padStart(4, '0')}`,
        menuItemId: item.id,
        qty: Math.max(0, Number(item.qty) || 0),
        perPersonLimit,
        chargeableUnitPrice,
      });
    }
  }
  if (rows.length === 0) return allocations;

  const guestCount = sessionGuestCountForLimits(orders);
  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const freeRemainingByMenuItem = new Map<string, number>();
  for (const row of rows) {
    const remaining =
      freeRemainingByMenuItem.get(row.menuItemId) ??
      freeAllowanceQty(row.perPersonLimit, guestCount);
    const { includedQty, overageQty } = splitQtyAgainstFreeRemaining(row.qty, remaining);
    freeRemainingByMenuItem.set(row.menuItemId, remaining - includedQty);
    allocations.set(row.key, {
      freeQty: includedQty,
      chargeableQty: overageQty,
      chargeableUnitPrice: row.chargeableUnitPrice,
    });
  }
  return allocations;
}

/** Normalize limit pair for menu CRUD: both null, or both set. */
export function normalizeMenuItemLimitFields(input: {
  per_person_qty_limit?: unknown;
  over_limit_unit_price?: unknown;
}):
  | { ok: true; per_person_qty_limit: number | null; over_limit_unit_price: number | null }
  | { ok: false; error: 'invalid_per_person_qty_limit' | 'invalid_over_limit_unit_price' | 'limit_requires_overage_price' } {
  const rawLimit = input.per_person_qty_limit;
  const rawPrice = input.over_limit_unit_price;

  const limitEmpty =
    rawLimit === undefined ||
    rawLimit === null ||
    rawLimit === '' ||
    (typeof rawLimit === 'number' && !Number.isFinite(rawLimit));

  let limit: number | null = null;
  if (!limitEmpty) {
    const n = typeof rawLimit === 'number' ? rawLimit : Number(rawLimit);
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, error: 'invalid_per_person_qty_limit' };
    }
    limit = n;
  }

  const priceEmpty =
    rawPrice === undefined ||
    rawPrice === null ||
    rawPrice === '' ||
    (typeof rawPrice === 'number' && !Number.isFinite(rawPrice));

  let overPrice: number | null = null;
  if (!priceEmpty) {
    const n = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: 'invalid_over_limit_unit_price' };
    }
    overPrice = n;
  }

  if (limit === null && overPrice === null) {
    return { ok: true, per_person_qty_limit: null, over_limit_unit_price: null };
  }
  if (limit !== null && overPrice !== null) {
    return { ok: true, per_person_qty_limit: limit, over_limit_unit_price: overPrice };
  }
  return { ok: false, error: 'limit_requires_overage_price' };
}

/** Hint inputs when the item is limited in sushi mode (null otherwise). */
export function sushiLimitHintParts(
  serviceMode: unknown,
  item: SushiLimitMenuFields,
): { perPerson: number; overLimitPrice: number } | null {
  if (!isLimitedSushiMenuItem(serviceMode, item)) return null;
  const over = overLimitUnitPriceOf(item);
  if (over === null) return null;
  return {
    perPerson: item.per_person_qty_limit!,
    overLimitPrice: over,
  };
}

/** Overage slice qty for a staff-assisted cart qty (0 if none / not limited). */
export function staffAssistedOverageQty(params: {
  serviceMode: unknown;
  item: SushiLimitMenuFields;
  guestCount: number;
  alreadyOrdered: number;
  requestQty: number;
}):
  | { ok: true; overageQty: number; overLimitUnitPrice: number }
  | { ok: false; error: SushiLimitError } {
  if (!isLimitedSushiMenuItem(params.serviceMode, params.item)) {
    return { ok: true, overageQty: 0, overLimitUnitPrice: 0 };
  }
  const ready = assertLimitedSushiReady(params.guestCount, params.item);
  if (!ready.ok) return ready;
  const { overageQty } = splitQtyAgainstFreeRemaining(
    Math.max(0, params.requestQty),
    freeRemainingQty({
      perPersonLimit: params.item.per_person_qty_limit!,
      guestCount: params.guestCount,
      alreadyOrdered: params.alreadyOrdered,
    }),
  );
  return { ok: true, overageQty, overLimitUnitPrice: ready.overLimitUnitPrice };
}

export type StaffQtyIncreaseGate =
  | { action: 'allow' }
  | { action: 'block_headcount' }
  | {
      action: 'confirm_first_cross';
      overageQtyAdded: number;
      totalOverageQty: number;
      overLimitUnitPrice: number;
    }
  | {
      action: 'toast_more_overage';
      overageQtyAdded: number;
      totalOverageQty: number;
      overLimitUnitPrice: number;
    };

/**
 * Staff +1 / set-higher qty gate (option B): confirm only on first cross into overage;
 * further overage increases toast; within free allowance allows.
 */
export function classifyStaffQtyIncrease(params: {
  serviceMode: unknown;
  item: SushiLimitMenuFields;
  guestCount: number;
  alreadyOrdered: number;
  fromQty: number;
  toQty: number;
}): StaffQtyIncreaseGate {
  if (params.toQty <= params.fromQty) return { action: 'allow' };
  if (!isLimitedSushiMenuItem(params.serviceMode, params.item)) return { action: 'allow' };
  if (params.guestCount < 1) return { action: 'block_headcount' };

  const before = staffAssistedOverageQty({
    serviceMode: params.serviceMode,
    item: params.item,
    guestCount: params.guestCount,
    alreadyOrdered: params.alreadyOrdered,
    requestQty: Math.max(0, params.fromQty),
  });
  const after = staffAssistedOverageQty({
    serviceMode: params.serviceMode,
    item: params.item,
    guestCount: params.guestCount,
    alreadyOrdered: params.alreadyOrdered,
    requestQty: params.toQty,
  });
  if (!before.ok || !after.ok) {
    if (
      (!before.ok && before.error === 'limited_item_requires_headcount') ||
      (!after.ok && after.error === 'limited_item_requires_headcount')
    ) {
      return { action: 'block_headcount' };
    }
    return { action: 'allow' };
  }

  const overageBefore = before.overageQty;
  const overageAfter = after.overageQty;
  if (overageAfter <= overageBefore) return { action: 'allow' };

  const overageQtyAdded = overageAfter - overageBefore;
  const shared = {
    overageQtyAdded,
    totalOverageQty: overageAfter,
    overLimitUnitPrice: after.overLimitUnitPrice,
  };
  if (overageBefore === 0) {
    return { action: 'confirm_first_cross', ...shared };
  }
  return { action: 'toast_more_overage', ...shared };
}

export type StaffCartOverageLine = {
  menuItemId: string;
  overageQty: number;
  overLimitUnitPrice: number;
};

export type StaffCartOveragePreview =
  | { status: 'none' }
  | { status: 'overage'; lines: StaffCartOverageLine[] }
  | { status: 'blocked'; error: SushiLimitError };

/** Submit-time preview: any staff cart lines that would bill overage. */
export function previewStaffCartOverage(params: {
  serviceMode: unknown;
  guestCount: number;
  sessionOrders: Array<Pick<Order, 'items' | 'status'>>;
  cart: Array<{ menuItemId: string; qty: number }>;
  resolveItem: (menuItemId: string) => SushiLimitMenuFields | null;
}): StaffCartOveragePreview {
  const lines: StaffCartOverageLine[] = [];
  for (const row of params.cart) {
    const item = params.resolveItem(row.menuItemId);
    if (!item) continue;
    if (!isLimitedSushiMenuItem(params.serviceMode, item)) continue;
    const result = staffAssistedOverageQty({
      serviceMode: params.serviceMode,
      item,
      guestCount: params.guestCount,
      alreadyOrdered: sessionOrderedQtyForMenuItem(params.sessionOrders, row.menuItemId),
      requestQty: coercePositiveQty(row.qty),
    });
    if (!result.ok) return { status: 'blocked', error: result.error };
    if (result.overageQty > 0) {
      lines.push({
        menuItemId: row.menuItemId,
        overageQty: result.overageQty,
        overLimitUnitPrice: result.overLimitUnitPrice,
      });
    }
  }
  if (lines.length === 0) return { status: 'none' };
  return { status: 'overage', lines };
}

/** True when guest cart includes any limited sushi line (needs session orders for precheck). */
export function guestCartHasLimitedSushiItems(params: {
  serviceMode: unknown;
  cart: Array<{ menuItemId: string }>;
  resolveItem: (menuItemId: string) => SushiLimitMenuFields | null;
}): boolean {
  for (const row of params.cart) {
    const item = params.resolveItem(row.menuItemId);
    if (item && isLimitedSushiMenuItem(params.serviceMode, item)) return true;
  }
  return false;
}

/**
 * Guest submit gate: same rule as append (`checkSushiLimitForCartLine`, not staff).
 * UI may keep limited dishes tappable; authority is submit (+ server).
 */
export function previewGuestCartSushiGate(params: {
  serviceMode: unknown;
  guestCount: number;
  sessionOrders: Array<Pick<Order, 'items' | 'status'>>;
  cart: Array<{ menuItemId: string; qty: number }>;
  resolveItem: (menuItemId: string) => SushiLimitMenuFields | null;
}): SushiLimitCheckResult {
  for (const row of params.cart) {
    const item = params.resolveItem(row.menuItemId);
    if (!item) continue;
    const checked = checkSushiLimitForCartLine({
      serviceMode: params.serviceMode,
      staffAssisted: false,
      guestCount: params.guestCount,
      alreadyOrdered: sessionOrderedQtyForMenuItem(params.sessionOrders, row.menuItemId),
      requestQty: coercePositiveQty(row.qty),
      item,
    });
    if (!checked.ok) return checked;
  }
  return { ok: true };
}

function coercePositiveQty(qty: number): number {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}
