import type { Order } from '@/types';
import { aggregateBuffetHeadcountForOrders } from '@/lib/buffet-order';
import { isSushiBuffetMode } from '@/lib/buffet-service-mode';
import { normalizeOrderItemStatus } from '@/lib/order-status';

export type SushiLimitMenuFields = {
  per_person_qty_limit?: number | null;
  over_limit_unit_price?: number | null;
};

/** Adults + children across all active buffet packages (0 if none / all zero). */
export function sessionGuestCountForLimits(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): number {
  const head = aggregateBuffetHeadcountForOrders(orders);
  if (!head) return 0;
  return Math.max(0, (head.adults || 0) + (head.children || 0));
}

/** Non-voided menu line qty for one menu_item id in the session. */
export function sessionOrderedQtyForMenuItem(
  orders: Array<Pick<Order, 'items' | 'status'>>,
  menuItemId: string,
): number {
  let total = 0;
  for (const order of orders) {
    for (const item of order.items || []) {
      if (item.kind === 'buffet_base') continue;
      if (item.id !== menuItemId) continue;
      if (normalizeOrderItemStatus(item, order.status) === 'voided') continue;
      const qty = Number(item.qty);
      if (Number.isFinite(qty) && qty > 0) total += qty;
    }
  }
  return total;
}

export function isLimitedSushiMenuItem(
  serviceMode: unknown,
  item: SushiLimitMenuFields,
): boolean {
  if (!isSushiBuffetMode(serviceMode)) return false;
  const limit = item.per_person_qty_limit;
  return typeof limit === 'number' && Number.isInteger(limit) && limit >= 1;
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

export type ApplySushiLimitError =
  | 'limited_item_requires_headcount'
  | 'per_person_limit_exceeded'
  | 'over_limit_price_missing';

export type ApplySushiLimitLineSuccess = {
  ok: true;
  /** One or two priced slices (same menu identity; different unit price). */
  slices: Array<{ qty: number; unitPrice: number }>;
};

export type ApplySushiLimitLineResult =
  | ApplySushiLimitLineSuccess
  | { ok: false; error: ApplySushiLimitError };

/**
 * Price one cart line under sushi limits.
 * Guest: may only use free remaining (hard cap).
 * Staff-assisted: may exceed; overage uses over_limit_unit_price.
 * Limited items require guestCount > 0 for everyone.
 */
export function applySushiLimitToCartLine(params: {
  serviceMode: unknown;
  staffAssisted: boolean;
  guestCount: number;
  alreadyOrdered: number;
  requestQty: number;
  menuPrice: number;
  item: SushiLimitMenuFields;
}): ApplySushiLimitLineResult {
  if (params.requestQty <= 0) {
    return { ok: true, slices: [] };
  }
  if (!isLimitedSushiMenuItem(params.serviceMode, params.item)) {
    return {
      ok: true,
      slices: [{ qty: params.requestQty, unitPrice: params.menuPrice }],
    };
  }

  const perPerson = params.item.per_person_qty_limit!;
  if (params.guestCount < 1) {
    return { ok: false, error: 'limited_item_requires_headcount' };
  }

  const overPrice = params.item.over_limit_unit_price;
  if (typeof overPrice !== 'number' || !Number.isFinite(overPrice) || overPrice < 0) {
    return { ok: false, error: 'over_limit_price_missing' };
  }

  const freeRemaining = freeRemainingQty({
    perPersonLimit: perPerson,
    guestCount: params.guestCount,
    alreadyOrdered: params.alreadyOrdered,
  });
  const { includedQty, overageQty } = splitQtyAgainstFreeRemaining(
    params.requestQty,
    freeRemaining,
  );

  if (!params.staffAssisted && overageQty > 0) {
    return { ok: false, error: 'per_person_limit_exceeded' };
  }

  const slices: Array<{ qty: number; unitPrice: number }> = [];
  if (includedQty > 0) {
    slices.push({ qty: includedQty, unitPrice: params.menuPrice });
  }
  if (overageQty > 0) {
    slices.push({ qty: overageQty, unitPrice: overPrice });
  }
  if (slices.length === 0) {
    return { ok: false, error: 'per_person_limit_exceeded' };
  }
  return { ok: true, slices };
}

/**
 * Free slots left for a guest cart line (0 when headcount unset).
 * Guest menu does not hard-disable Add from this; submit uses {@link previewGuestCartSushiGate}.
 */
export function guestMaxCartQty(params: {
  serviceMode: unknown;
  item: SushiLimitMenuFields;
  guestCount: number;
  alreadyOrdered: number;
  absoluteMax: number;
}): number {
  if (!isLimitedSushiMenuItem(params.serviceMode, params.item)) {
    return params.absoluteMax;
  }
  if (params.guestCount < 1) return 0;
  return Math.min(
    params.absoluteMax,
    freeRemainingQty({
      perPersonLimit: params.item.per_person_qty_limit!,
      guestCount: params.guestCount,
      alreadyOrdered: params.alreadyOrdered,
    }),
  );
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
  const over = item.over_limit_unit_price;
  if (typeof over !== 'number' || !Number.isFinite(over)) return null;
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
  | { ok: false; error: ApplySushiLimitError } {
  if (!isLimitedSushiMenuItem(params.serviceMode, params.item)) {
    return { ok: true, overageQty: 0, overLimitUnitPrice: 0 };
  }
  if (params.guestCount < 1) {
    return { ok: false, error: 'limited_item_requires_headcount' };
  }
  const overPrice = params.item.over_limit_unit_price;
  if (typeof overPrice !== 'number' || !Number.isFinite(overPrice) || overPrice < 0) {
    return { ok: false, error: 'over_limit_price_missing' };
  }
  const { overageQty } = splitQtyAgainstFreeRemaining(
    Math.max(0, params.requestQty),
    freeRemainingQty({
      perPersonLimit: params.item.per_person_qty_limit!,
      guestCount: params.guestCount,
      alreadyOrdered: params.alreadyOrdered,
    }),
  );
  return { ok: true, overageQty, overLimitUnitPrice: overPrice };
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
  | { status: 'blocked'; error: ApplySushiLimitError };

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

/**
 * Guest submit gate: same pricing rules as append (`applySushiLimitToCartLine`, not staff).
 * UI may keep limited dishes tappable; authority is submit (+ server).
 */
export function previewGuestCartSushiGate(params: {
  serviceMode: unknown;
  guestCount: number;
  sessionOrders: Array<Pick<Order, 'items' | 'status'>>;
  cart: Array<{ menuItemId: string; qty: number }>;
  resolveItem: (menuItemId: string) => (SushiLimitMenuFields & { price?: number }) | null;
}): { ok: true } | { ok: false; error: ApplySushiLimitError } {
  for (const row of params.cart) {
    const item = params.resolveItem(row.menuItemId);
    if (!item) continue;
    const priced = applySushiLimitToCartLine({
      serviceMode: params.serviceMode,
      staffAssisted: false,
      guestCount: params.guestCount,
      alreadyOrdered: sessionOrderedQtyForMenuItem(params.sessionOrders, row.menuItemId),
      requestQty: coercePositiveQty(row.qty),
      menuPrice: typeof item.price === 'number' && Number.isFinite(item.price) ? item.price : 0,
      item,
    });
    if (!priced.ok) return { ok: false, error: priced.error };
  }
  return { ok: true };
}

function coercePositiveQty(qty: number): number {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}
