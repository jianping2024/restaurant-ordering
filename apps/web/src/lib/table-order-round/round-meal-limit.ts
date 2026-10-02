import {
  checkSushiLimitForCartLine,
  isLimitedSushiMenuItem,
  sessionOrderedQtyForMenuItem,
  type SushiLimitCheckResult,
  type SushiLimitError,
  type SushiLimitMenuFields,
} from '@/lib/sushi-buffet-limits';
import {
  normalizeRoundLineNote,
  resolveRoundLineUpsertPlan,
  roundLinesMatchIdentity,
} from '@/lib/table-order-round/round-line-identity';
import type { Order } from '@/types';

type RoundLineMealPreviewRow = {
  menu_item_id: string;
  guest_client_id: string;
  note?: string | null;
  qty: number;
};

/** Sole guest local preview outcome for free-cart draft / 核单 set (meal + round cap). */
export type GuestRoundQtyPreviewResult =
  | { ok: true }
  | { ok: false; error: SushiLimitError }
  | { ok: false; error: 'round_cap_exceeded'; used: number; cap: number };

function nonNegInt(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Sole server wire for upsert meal free-cap flags (round path is sushi-only).
 * Limited free dish without a valid overage price → same error as append.
 */
export function resolveRoundLineMealLimitApply(item: SushiLimitMenuFields):
  | { ok: true; applyMealLimit: false; perPersonMealLimit: null }
  | { ok: true; applyMealLimit: true; perPersonMealLimit: number }
  | { ok: false; error: 'over_limit_price_missing' } {
  if (!isLimitedSushiMenuItem('sushi', item)) {
    return { ok: true, applyMealLimit: false, perPersonMealLimit: null };
  }
  const limit = item.per_person_qty_limit;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1) {
    return { ok: true, applyMealLimit: false, perPersonMealLimit: null };
  }
  const over = item.over_limit_unit_price;
  if (typeof over !== 'number' || !Number.isFinite(over) || over < 0) {
    return { ok: false, error: 'over_limit_price_missing' };
  }
  return { ok: true, applyMealLimit: true, perPersonMealLimit: limit };
}

/**
 * Sole guest meal-limit preview for round writes (cart 下单 / 核单 UI).
 * Matches upsert RPC: already = session ordered + other round lines for the dish;
 * request = next absolute qty after set/add.
 */
export function previewGuestRoundLineMealGate(params: {
  serviceMode: unknown;
  guestCount: number;
  sessionOrders: Array<Pick<Order, 'items' | 'status'>>;
  roundLines: RoundLineMealPreviewRow[];
  guestClientId: string;
  menuItemId: string;
  note: unknown;
  qty: number;
  qtyMode: 'set' | 'add';
  item: SushiLimitMenuFields;
}): SushiLimitCheckResult {
  const plan = resolveRoundLineUpsertPlan({
    existingLines: params.roundLines,
    menuItemId: params.menuItemId,
    guestClientId: params.guestClientId,
    note: params.note,
    qty: params.qty,
    qtyMode: params.qtyMode,
  });
  let mealOtherFromRound = 0;
  const note = normalizeRoundLineNote(params.note);
  for (const line of params.roundLines) {
    if (line.menu_item_id !== params.menuItemId) continue;
    if (
      line.guest_client_id === params.guestClientId &&
      normalizeRoundLineNote(line.note) === note
    ) {
      continue;
    }
    const q = Math.floor(Number(line.qty));
    if (Number.isFinite(q) && q > 0) mealOtherFromRound += q;
  }
  return checkSushiLimitForCartLine({
    serviceMode: params.serviceMode,
    staffAssisted: false,
    guestCount: params.guestCount,
    alreadyOrdered:
      sessionOrderedQtyForMenuItem(params.sessionOrders, params.menuItemId) + mealOtherFromRound,
    requestQty: plan.nextQty,
    item: params.item,
  });
}

/**
 * Sole free-cart meal preview before commitCartToRound (qtyMode add, sequential).
 * Simulates prior cart rows into the working round so multi-line carts share one gate.
 */
export function previewGuestRoundCartMealGate(params: {
  serviceMode: unknown;
  guestCount: number;
  sessionOrders: Array<Pick<Order, 'items' | 'status'>>;
  roundLines: RoundLineMealPreviewRow[];
  guestClientId: string;
  cart: Array<{
    menuItemId: string;
    qty: number;
    note: unknown;
    item: SushiLimitMenuFields;
  }>;
}): SushiLimitCheckResult {
  let lines: RoundLineMealPreviewRow[] = params.roundLines.map((l) => ({ ...l }));
  for (const row of params.cart) {
    const gate = previewGuestRoundLineMealGate({
      serviceMode: params.serviceMode,
      guestCount: params.guestCount,
      sessionOrders: params.sessionOrders,
      roundLines: lines,
      guestClientId: params.guestClientId,
      menuItemId: row.menuItemId,
      note: row.note,
      qty: row.qty,
      qtyMode: 'add',
      item: row.item,
    });
    if (!gate.ok) return gate;
    const plan = resolveRoundLineUpsertPlan({
      existingLines: lines,
      menuItemId: row.menuItemId,
      guestClientId: params.guestClientId,
      note: row.note,
      qty: row.qty,
      qtyMode: 'add',
    });
    const identity = {
      menuItemId: row.menuItemId,
      guestClientId: params.guestClientId,
      note: plan.note,
    };
    if (plan.existing) {
      lines = lines.map((l) =>
        roundLinesMatchIdentity(l, identity) ? { ...l, qty: plan.nextQty, note: plan.note } : l,
      );
    } else {
      lines = [
        ...lines,
        {
          menu_item_id: row.menuItemId,
          guest_client_id: params.guestClientId,
          note: plan.note,
          qty: plan.nextQty,
        },
      ];
    }
  }
  return { ok: true };
}

/**
 * Round-cap preview for free-cart draft (qtyMode add on 下单): basket used + Σ draft qtys.
 * Does not see other phones' drafts — same as write path before commit.
 */
export function previewGuestRoundCartCapGate(params: {
  linesQtyTotal: number;
  roundCapTotal: number;
  cartQtys: number[];
}): GuestRoundQtyPreviewResult {
  const cartSum = params.cartQtys.reduce((sum, q) => sum + nonNegInt(q), 0);
  if (cartSum <= 0) return { ok: true };
  const used = nonNegInt(params.linesQtyTotal) + cartSum;
  const cap = nonNegInt(params.roundCapTotal);
  if (used > cap) {
    return { ok: false, error: 'round_cap_exceeded', used, cap };
  }
  return { ok: true };
}

/**
 * Round-cap preview for 核单 absolute set on one line (exclude that line then add nextQty).
 */
export function previewGuestRoundLineCapGate(params: {
  linesQtyTotal: number;
  roundCapTotal: number;
  currentLineQty: number;
  nextQty: number;
}): GuestRoundQtyPreviewResult {
  const next = Math.floor(Number(params.nextQty));
  if (!Number.isFinite(next) || next <= 0) return { ok: true };
  const others = Math.max(0, nonNegInt(params.linesQtyTotal) - nonNegInt(params.currentLineQty));
  const used = others + next;
  const cap = nonNegInt(params.roundCapTotal);
  if (used > cap) {
    return { ok: false, error: 'round_cap_exceeded', used, cap };
  }
  return { ok: true };
}

type CartDraftGateRow = {
  menuItemId: string;
  qty: number;
  note: unknown;
  item: SushiLimitMenuFields;
};

/**
 * Sole guest preview for free-cart draft writes (菜卡/详情/购物车加份 + 下单前).
 * Cap then meal; UI must not call meal/cap helpers beside this for those paths.
 */
export function previewGuestRoundCartDraftGates(params: {
  linesQtyTotal: number;
  roundCapTotal: number;
  serviceMode: unknown;
  guestCount: number;
  sessionOrders: Array<Pick<Order, 'items' | 'status'>>;
  roundLines: RoundLineMealPreviewRow[];
  guestClientId: string;
  cart: CartDraftGateRow[];
}): GuestRoundQtyPreviewResult {
  const capGate = previewGuestRoundCartCapGate({
    linesQtyTotal: params.linesQtyTotal,
    roundCapTotal: params.roundCapTotal,
    cartQtys: params.cart.map((row) => row.qty),
  });
  if (!capGate.ok) return capGate;
  return previewGuestRoundCartMealGate({
    serviceMode: params.serviceMode,
    guestCount: params.guestCount,
    sessionOrders: params.sessionOrders,
    roundLines: params.roundLines,
    guestClientId: params.guestClientId,
    cart: params.cart,
  });
}

/**
 * Sole guest preview for 核单本机行 set qty (cap + meal).
 * UI must not call meal/cap helpers beside this for that path.
 */
export function previewGuestRoundLineSetGates(params: {
  linesQtyTotal: number;
  roundCapTotal: number;
  currentLineQty: number;
  serviceMode: unknown;
  guestCount: number;
  sessionOrders: Array<Pick<Order, 'items' | 'status'>>;
  roundLines: RoundLineMealPreviewRow[];
  guestClientId: string;
  menuItemId: string;
  note: unknown;
  qty: number;
  item: SushiLimitMenuFields;
}): GuestRoundQtyPreviewResult {
  const capGate = previewGuestRoundLineCapGate({
    linesQtyTotal: params.linesQtyTotal,
    roundCapTotal: params.roundCapTotal,
    currentLineQty: params.currentLineQty,
    nextQty: params.qty,
  });
  if (!capGate.ok) return capGate;
  return previewGuestRoundLineMealGate({
    serviceMode: params.serviceMode,
    guestCount: params.guestCount,
    sessionOrders: params.sessionOrders,
    roundLines: params.roundLines,
    guestClientId: params.guestClientId,
    menuItemId: params.menuItemId,
    note: params.note,
    qty: params.qty,
    qtyMode: 'set',
    item: params.item,
  });
}
