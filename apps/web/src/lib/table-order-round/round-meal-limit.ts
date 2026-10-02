import {
  checkSushiLimitForCartLine,
  isLimitedSushiMenuItem,
  sessionOrderedQtyForMenuItem,
  type SushiLimitCheckResult,
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

type RoundFreeCartMealRow = {
  menuItemId: string;
  qty: number;
  note: unknown;
  item: SushiLimitMenuFields;
};

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
  cart: RoundFreeCartMealRow[];
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
 * Sole guest meal-limit preview when setting one free-cart draft qty (菜卡/详情/购物车).
 * Replaces that menuItemId row in the free-cart snapshot, then reuses
 * {@link previewGuestRoundCartMealGate} (same rule as 下单). Clear / non-positive → ok.
 */
export function previewGuestRoundCartDraftQtyMealGate(params: {
  serviceMode: unknown;
  guestCount: number;
  sessionOrders: Array<Pick<Order, 'items' | 'status'>>;
  roundLines: RoundLineMealPreviewRow[];
  guestClientId: string;
  freeCart: RoundFreeCartMealRow[];
  menuItemId: string;
  nextQty: number;
  note: unknown;
  item: SushiLimitMenuFields;
}): SushiLimitCheckResult {
  const nextQty = Math.floor(Number(params.nextQty));
  if (!Number.isFinite(nextQty) || nextQty <= 0) return { ok: true };

  const nextCart: RoundFreeCartMealRow[] = [];
  let replaced = false;
  for (const row of params.freeCart) {
    if (row.menuItemId !== params.menuItemId) {
      nextCart.push(row);
      continue;
    }
    replaced = true;
    nextCart.push({
      menuItemId: row.menuItemId,
      qty: nextQty,
      note: params.note,
      item: params.item,
    });
  }
  if (!replaced) {
    nextCart.push({
      menuItemId: params.menuItemId,
      qty: nextQty,
      note: params.note,
      item: params.item,
    });
  }
  return previewGuestRoundCartMealGate({
    serviceMode: params.serviceMode,
    guestCount: params.guestCount,
    sessionOrders: params.sessionOrders,
    roundLines: params.roundLines,
    guestClientId: params.guestClientId,
    cart: nextCart,
  });
}
