import type { DishFeedbackVote } from '@/types';

/** Sole reason-key set for guest dish feedback (UI + API). */
export const DISH_FEEDBACK_REASON_KEYS = [
  'taste',
  'temp',
  'slow',
  'mismatch',
  'other',
] as const;

export type DishFeedbackReasonKey = (typeof DISH_FEEDBACK_REASON_KEYS)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

export function isDishFeedbackReasonKey(v: unknown): v is DishFeedbackReasonKey {
  return (
    typeof v === 'string' &&
    (DISH_FEEDBACK_REASON_KEYS as readonly string[]).includes(v)
  );
}

export function parseDishFeedbackReasons(raw: unknown): DishFeedbackReasonKey[] {
  if (!Array.isArray(raw)) return [];
  const out: DishFeedbackReasonKey[] = [];
  for (const entry of raw) {
    if (isDishFeedbackReasonKey(entry) && !out.includes(entry)) out.push(entry);
    if (out.length >= DISH_FEEDBACK_REASON_KEYS.length) break;
  }
  return out;
}

export type ParsedDishFeedbackItem = {
  menu_item_id: string;
  order_id: string;
  vote: DishFeedbackVote;
  reasons: DishFeedbackReasonKey[];
};

/** Pure: validate submit payload shape (no I/O). */
export function parseDishFeedbackSubmitItems(
  raw: unknown,
): { ok: true; items: ParsedDishFeedbackItem[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 80) {
    return { ok: false, error: 'invalid_items' };
  }
  const items: ParsedDishFeedbackItem[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      return { ok: false, error: 'invalid_items' };
    }
    const r = entry as Record<string, unknown>;
    const menuItemId =
      typeof r.menu_item_id === 'string' ? r.menu_item_id.trim() : '';
    const orderId = typeof r.order_id === 'string' ? r.order_id.trim() : '';
    if (!isUuid(menuItemId) || !isUuid(orderId)) {
      return { ok: false, error: 'invalid_items' };
    }
    if (seen.has(menuItemId)) {
      return { ok: false, error: 'duplicate_menu_item' };
    }
    seen.add(menuItemId);
    const vote = r.vote === 'up' || r.vote === 'down' ? r.vote : null;
    if (!vote) return { ok: false, error: 'invalid_vote' };
    const reasons = vote === 'down' ? parseDishFeedbackReasons(r.reasons) : [];
    if (vote === 'down' && reasons.length > DISH_FEEDBACK_REASON_KEYS.length) {
      return { ok: false, error: 'invalid_reasons' };
    }
    items.push({ menu_item_id: menuItemId, order_id: orderId, vote, reasons });
  }
  return { ok: true, items };
}
