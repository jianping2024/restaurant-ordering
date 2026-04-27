/**
 * Shared cart / order-line totals so menu, cart UI, and merged DB rows stay consistent.
 * Supports legacy rows that used `quantity` instead of `qty`.
 */
export type LinePriced = { price?: unknown; qty?: unknown; quantity?: unknown };

function parseMoney(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value === 'string') {
    const t = value.trim().replace(/\s/g, '');
    const normalized =
      t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t.replace(/,/g, '');
    const n = Number(normalized.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : NaN;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function parseQty(value: unknown): number {
  if (value == null) return NaN;
  if (typeof value === 'boolean') return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '') return NaN;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export function lineTotal(it: LinePriced): number {
  const price = parseMoney(it.price);
  const rawQty = it.qty !== undefined && it.qty !== null ? it.qty : it.quantity;
  const qty = parseQty(rawQty);
  if (!Number.isFinite(price) || !Number.isFinite(qty)) return 0;
  return price * qty;
}

export function sumLineTotals(items: LinePriced[]): number {
  return items.reduce((sum, it) => {
    const line = lineTotal(it);
    return Number(sum) + line;
  }, 0);
}

/** Normalize menu / DB price values for cart lines (Supabase numeric is often a string). */
export function coerceCartPrice(value: unknown): number {
  const n = parseMoney(value);
  return Number.isFinite(n) ? n : 0;
}

/** Normalize quantity for cart lines (avoids string concat bugs from loose typing). */
export function coerceCartQty(value: unknown): number {
  const n = parseQty(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
