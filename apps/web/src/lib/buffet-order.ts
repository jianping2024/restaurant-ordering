import type { Buffet, Order, OrderItem } from '@/types';
import { isBuffetBaseItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';

/** Mark active buffet_base lines void (keeps history for merge/audit). */
export function voidActiveBuffetBaseLines(items: OrderItem[]): OrderItem[] {
  const voidedAt = new Date().toISOString();
  return items.map((item) => {
    if (!isBuffetBaseItem(item)) return item;
    if (item.item_status === 'voided') return item;
    return { ...item, item_status: 'voided' as const, voided_at: voidedAt };
  });
}

function activeBuffetBaseLines(orders: Array<Pick<Order, 'items' | 'status'>>): OrderItem[] {
  const lines: OrderItem[] = [];
  for (const order of orders) {
    for (const item of order.items) {
      if (!isBuffetBaseItem(item)) continue;
      if (normalizeOrderItemStatus(item, order.status) === 'voided') continue;
      lines.push(item);
    }
  }
  return lines;
}

/** Newest active buffet_base line across session orders (headcount + amount authority). */
export function latestActiveBuffetBaseLine(orders: Array<Pick<Order, 'items' | 'status'>>): OrderItem | null {
  const active = activeBuffetBaseLines(orders);
  if (active.length === 0) return null;

  const buffetIds = new Set(active.map((l) => l.buffet_id).filter(Boolean) as string[]);
  if (buffetIds.size > 1) return null;

  let best: OrderItem | null = null;
  let bestAt = '';
  for (const line of active) {
    const at = line.added_at || '';
    if (!best || at >= bestAt) {
      best = line;
      bestAt = at;
    }
  }
  return best;
}

/** Append a new buffet_base after voiding prior active buffet lines on the same order. */
export function mergeBuffetLineOntoOrderItems(
  existingItems: OrderItem[],
  newLine: OrderItem,
): OrderItem[] {
  return [...voidActiveBuffetBaseLines(existingItems), newLine];
}

export function aggregateBuffetForOrders(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): { buffetId: string; name: string; adults: number; children: number; amount: number } | null {
  const line = latestActiveBuffetBaseLine(orders);
  if (!line?.buffet_id) return null;

  const name = line.name || line.name_pt || 'Buffet';
  const adults = line.adult_count ?? 0;
  const children = line.child_count ?? 0;
  const amount = line.price * (line.qty ?? 1);

  return {
    buffetId: line.buffet_id,
    name,
    adults,
    children,
    amount,
  };
}

/** Non-negative integer adult/child counts for buffet open-table and pricing. */
export function normalizeBuffetGuestCounts(
  adultCount: number,
  childCount: number,
): { adults: number; children: number } {
  return {
    adults: Math.max(0, Math.floor(adultCount)),
    children: Math.max(0, Math.floor(childCount)),
  };
}

/** True when buffet type and adult/child counts match (compared separately, not as a total). */
export function isBuffetGuestCountsUnchanged(
  orders: Array<Pick<Order, 'items' | 'status'>>,
  buffetId: string,
  adultCount: number,
  childCount: number,
): boolean {
  const agg = aggregateBuffetForOrders(orders);
  if (!agg) return false;
  const { adults, children } = normalizeBuffetGuestCounts(adultCount, childCount);
  return agg.buffetId === buffetId && agg.adults === adults && agg.children === children;
}

/** Compact adult/child headcount, e.g. A7 C3. */
export function formatBuffetHeadcountLabel(adults: number, children: number): string {
  return `A${adults} C${children}`;
}

/** Thermal receipt Qty column for buffet_base lines, e.g. A4-C2, A9, C3 (no spaces; omit zero segments). */
export function formatBuffetReceiptQtyLabel(adults: number, children: number): string {
  const { adults: a, children: c } = normalizeBuffetGuestCounts(adults, children);
  if (a > 0 && c > 0) return `A${a}-C${c}`;
  if (a > 0) return `A${a}`;
  if (c > 0) return `C${c}`;
  return '';
}

/** Interpolate € placeholders in waiter buffet open-table copy. */
export function formatBuffetPriceTemplate(template: string, values: Record<string, number>): string {
  return Object.entries(values).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, value.toFixed(2)),
    template,
  );
}

export type BuffetOpenPricePreview =
  | { ok: true; adultPrice: number; childPrice: number; subtotal: number }
  | { ok: false };

function parseBuffetUnitPrices(
  resolved: ResolvedBuffetPriceRow,
): { adultPrice: number; childPrice: number } | null {
  if (resolved.adult_price == null || resolved.child_price == null) return null;
  const adultPrice = Number(resolved.adult_price);
  const childPrice = Number(resolved.child_price);
  if (!Number.isFinite(adultPrice) || !Number.isFinite(childPrice)) return null;
  return { adultPrice, childPrice };
}

export function computeBuffetSubtotal(
  adultCount: number,
  childCount: number,
  adultPrice: number,
  childPrice: number,
): number {
  const { adults, children } = normalizeBuffetGuestCounts(adultCount, childCount);
  return adults * adultPrice + children * childPrice;
}

/** Resolved slot prices + estimated subtotal for the open-table form. */
export function resolveBuffetOpenPricePreview(
  resolved: ResolvedBuffetPriceRow | null,
  adultCount: number,
  childCount: number,
): BuffetOpenPricePreview {
  if (!resolved) return { ok: false };
  const prices = parseBuffetUnitPrices(resolved);
  if (!prices) return { ok: false };
  return {
    ok: true,
    adultPrice: prices.adultPrice,
    childPrice: prices.childPrice,
    subtotal: computeBuffetSubtotal(adultCount, childCount, prices.adultPrice, prices.childPrice),
  };
}

/** Buffet headcount label; omits adult/child segments when count is zero. */
export function formatBuffetGuestCountsOptional(
  adults: number,
  children: number,
  templates: { adults: string; children: string },
): string {
  const parts: string[] = [];
  const { adults: a, children: c } = normalizeBuffetGuestCounts(adults, children);
  if (a > 0) parts.push(templates.adults.replace('{n}', String(a)));
  if (c > 0) parts.push(templates.children.replace('{n}', String(c)));
  return parts.join(' · ');
}

export interface ResolvedBuffetPriceRow {
  adult_price: number | null;
  child_price: number | null;
  rule_id: string | null;
  time_slot_id: string | null;
}

/** Normalize `resolve_buffet_prices` RPC row (array or single object). */
export function parseResolvedBuffetPriceRpcRow(priceRows: unknown): ResolvedBuffetPriceRow {
  const resolvedRow = Array.isArray(priceRows) ? priceRows[0] : priceRows;
  const row = resolvedRow as {
    adult_price?: unknown;
    child_price?: unknown;
    rule_id?: string | null;
    time_slot_id?: string | null;
  } | null;
  return {
    adult_price: row?.adult_price != null ? Number(row.adult_price) : null,
    child_price: row?.child_price != null ? Number(row.child_price) : null,
    rule_id: row?.rule_id ?? null,
    time_slot_id: row?.time_slot_id ?? null,
  };
}

export function buildBuffetBaseLine(params: {
  buffet: Pick<Buffet, 'id' | 'name'>;
  adultCount: number;
  childCount: number;
  resolved: ResolvedBuffetPriceRow;
}): OrderItem | null {
  const prices = parseBuffetUnitPrices(params.resolved);
  if (!prices) return null;
  const { adults, children } = normalizeBuffetGuestCounts(params.adultCount, params.childCount);
  const lineTotal = computeBuffetSubtotal(
    params.adultCount,
    params.childCount,
    prices.adultPrice,
    prices.childPrice,
  );
  const addedAt = new Date().toISOString();

  return {
    id: `buffet:${params.buffet.id}`,
    kind: 'buffet_base',
    name: params.buffet.name,
    name_pt: params.buffet.name,
    qty: 1,
    price: lineTotal,
    emoji: '🍽️',
    item_status: 'done',
    buffet_id: params.buffet.id,
    adult_count: adults,
    child_count: children,
    adult_unit_price: prices.adultPrice,
    child_unit_price: prices.childPrice,
    price_rule_id: params.resolved.rule_id || undefined,
    added_at: addedAt,
    batch_id: '__buffet__',
  };
}
