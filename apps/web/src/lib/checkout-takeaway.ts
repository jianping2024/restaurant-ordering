/**
 * Checkout take-away charge — cashier enters unit price + qty (default 1), fixed name.
 * Sole line shape: `OrderItem` kind `takeaway` built by {@link buildTakeawayChargeItem}.
 * Fiscal: fixed item_code {@link TAKEAWAY_ITEM_CODE}, `open_price` (one product, many prices).
 */
import type { OrderItem } from '@/types';

/** Fixed line name (screen, receipt, fiscal invoice — never editable). */
export const TAKEAWAY_LINE_NAME = 'TAKE AWAY (PAGA À PARTE).';

/** Fixed fiscal product code for every take-away line. */
export const TAKEAWAY_ITEM_CODE = 'TAKEAWAY';

/** `restaurants.takeaway_vat_rate` default (DB default too). */
export const TAKEAWAY_VAT_RATE_DEFAULT = 13;

/** Stored IVA % → whole percent 0..100 (settings UI + API). Invalid → default. */
export function resolveTakeawayVatRate(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 100) return TAKEAWAY_VAT_RATE_DEFAULT;
  return Math.round(n);
}

/** PATCH body `takeawayVatRate`: undefined = not sent, null = invalid. */
export function parseTakeawayVatRatePatch(body: unknown): number | undefined | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const raw = (body as Record<string, unknown>).takeawayVatRate;
  if (raw === undefined) return undefined;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 100) return null;
  return n;
}

/** Upper bound per unit price — guards typos (e.g. 5000 instead of 50.00). */
export const TAKEAWAY_AMOUNT_MAX = 1000;

/** Max qty per take-away line (editor + POST). */
export const TAKEAWAY_QTY_MAX = 99;

/** Max lines per add request. */
export const TAKEAWAY_LINES_MAX = 20;

const TAKEAWAY_ID_PREFIX = 'takeaway:';

/** One cashier-entered take-away row (unit price × qty). */
export type TakeawayLineInput = { amount: number; qty: number };

/** Euro amount with ≤2 decimals, 0 < amount ≤ max; else null. */
export function parseTakeawayAmount(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > TAKEAWAY_AMOUNT_MAX) return null;
  const cents = Math.round(n * 100);
  if (Math.abs(n * 100 - cents) > 1e-6) return null;
  return cents / 100;
}

/** Integer qty 1..TAKEAWAY_QTY_MAX; else null. */
export function parseTakeawayQty(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > TAKEAWAY_QTY_MAX) return null;
  return n;
}

/**
 * Sole POST body parser for take-away add: `lines: [{ amount, qty }, …]`.
 * Invalid / empty / over max → null.
 */
export function parseTakeawayLines(body: unknown): TakeawayLineInput[] | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const raw = (body as Record<string, unknown>).lines;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > TAKEAWAY_LINES_MAX) return null;
  const lines: TakeawayLineInput[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const row = entry as Record<string, unknown>;
    const amount = parseTakeawayAmount(row.amount);
    const qty = parseTakeawayQty(row.qty);
    if (amount == null || qty == null) return null;
    lines.push({ amount, qty });
  }
  return lines;
}

/** Sole take-away line builder (server only writes these into `orders.items`). */
export function buildTakeawayChargeItem(input: {
  lineId: string;
  amount: number;
  qty: number;
  batchId: string;
  addedAt: string;
}): OrderItem {
  return {
    id: `${TAKEAWAY_ID_PREFIX}${input.lineId}`,
    kind: 'takeaway',
    name: TAKEAWAY_LINE_NAME,
    name_pt: TAKEAWAY_LINE_NAME,
    name_en: TAKEAWAY_LINE_NAME,
    name_zh: TAKEAWAY_LINE_NAME,
    qty: input.qty,
    price: input.amount,
    emoji: '🥡',
    // Charged at the counter — nothing for the kitchen to cook.
    item_status: 'done',
    batch_id: input.batchId,
    added_at: input.addedAt,
  };
}
