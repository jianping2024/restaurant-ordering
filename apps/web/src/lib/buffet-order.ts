import type { Buffet, Order, OrderItem } from '@/types';
import { isBuffetBaseItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';

export type BuffetGuestCounts = { adults: number; children: number };

/**
 * The table's one buffet package + headcount (one table, one buffet).
 * 0 adults + 0 children = no buffet on the table (clears the buffet_base line).
 */
export type TableBuffetSelection = {
  buffetId: string;
  adults: number;
  children: number;
};

export type BuffetLineSummary = {
  buffetId: string;
  name: string;
  adults: number;
  children: number;
  amount: number;
};

/** Mark every active buffet_base line void (keeps history for audit). */
export function voidActiveBuffetBaseLines(items: OrderItem[]): OrderItem[] {
  const voidedAt = new Date().toISOString();
  return items.map((item) => {
    if (!isBuffetBaseItem(item)) return item;
    if (item.item_status === 'voided') return item;
    return { ...item, item_status: 'voided' as const, voided_at: voidedAt };
  });
}

export function listActiveBuffetBaseLines(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): OrderItem[] {
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

/** Latest active line per buffet_id (handles duplicate lines on one order). */
export function activeBuffetLineByBuffetId(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): Map<string, OrderItem> {
  const byId = new Map<string, OrderItem>();
  for (const line of listActiveBuffetBaseLines(orders)) {
    const buffetId = line.buffet_id;
    if (!buffetId) continue;
    const prev = byId.get(buffetId);
    if (!prev || String(line.added_at || '') >= String(prev.added_at || '')) {
      byId.set(buffetId, line);
    }
  }
  return byId;
}

/**
 * Sole TS read of the table's current buffet line: the newest active (not voided)
 * buffet_base line with a buffet_id.
 */
export function currentTableBuffetLine(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): OrderItem | null {
  let current: OrderItem | null = null;
  for (const line of Array.from(activeBuffetLineByBuffetId(orders).values())) {
    if (!current || String(line.added_at || '') >= String(current.added_at || '')) {
      current = line;
    }
  }
  return current;
}

/** The table's current buffet + headcount, or null when no active buffet line. */
export function currentTableBuffet(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): TableBuffetSelection | null {
  const line = currentTableBuffetLine(orders);
  if (!line?.buffet_id) return null;
  return {
    buffetId: line.buffet_id,
    adults: line.adult_count ?? 0,
    children: line.child_count ?? 0,
  };
}

export function listActiveBuffetLineSummaries(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): BuffetLineSummary[] {
  return Array.from(activeBuffetLineByBuffetId(orders).entries()).map(([buffetId, line]) => ({
    buffetId,
    name: line.name || line.name_pt || 'Buffet',
    adults: line.adult_count ?? 0,
    children: line.child_count ?? 0,
    amount: line.price * (line.qty ?? 1),
  }));
}

export type BuffetGuestHeadcount = { adults: number; children: number };

/** Adults + children for one package (or aggregate); nullish → 0. */
export function totalGuestsFromCounts(
  counts: { adults?: number; children?: number } | null | undefined,
): number {
  if (!counts) return 0;
  return Math.max(0, counts.adults || 0) + Math.max(0, counts.children || 0);
}

export function aggregateBuffetHeadcountForOrders(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): BuffetGuestHeadcount | null {
  const summaries = listActiveBuffetLineSummaries(orders);
  if (summaries.length === 0) return null;
  return summaries.reduce(
    (acc, row) => ({
      adults: acc.adults + row.adults,
      children: acc.children + row.children,
    }),
    { adults: 0, children: 0 },
  );
}

export type BuffetFormAlignState =
  | { mode: 'pending' }
  | { mode: 'idle'; defaultBuffetId: string | null }
  | { mode: 'session_open'; defaultBuffetId: string | null }
  | { mode: 'occupied'; selection: TableBuffetSelection };

export function resolveBuffetFormAlignState(input: {
  detailLoaded: boolean;
  hasOpenSession: boolean;
  orders: Array<Pick<Order, 'items' | 'status'>>;
  defaultBuffetId: string | null;
}): BuffetFormAlignState {
  if (!input.detailLoaded) {
    return { mode: 'pending' };
  }

  const selection = currentTableBuffet(input.orders);
  if (selection) {
    return { mode: 'occupied', selection };
  }

  if (input.hasOpenSession) {
    return { mode: 'session_open', defaultBuffetId: input.defaultBuffetId };
  }

  return { mode: 'idle', defaultBuffetId: input.defaultBuffetId };
}

function tableBuffetSelectionKey(selection: TableBuffetSelection | null): string {
  if (!selection) return 'none';
  return `${selection.buffetId}:${selection.adults}:${selection.children}`;
}

export function buffetFormAlignKey(
  tableId: string,
  sessionId: string | null,
  align: BuffetFormAlignState,
): string {
  const sessionKey = sessionId ?? 'none';
  if (align.mode === 'occupied') {
    return `${tableId}:${sessionKey}:occupied:${tableBuffetSelectionKey(align.selection)}`;
  }
  if (align.mode === 'pending') {
    return `${tableId}:${sessionKey}:pending`;
  }
  return `${tableId}:${sessionKey}:${align.mode}:${align.defaultBuffetId ?? ''}`;
}

export function normalizeBuffetGuestCounts(
  adultCount: number,
  childCount: number,
): BuffetGuestCounts {
  return {
    adults: Math.max(0, Math.floor(adultCount)),
    children: Math.max(0, Math.floor(childCount)),
  };
}

/**
 * Selection the table ends up with: null when no package or 0 + 0 guests
 * (server voids the buffet line).
 */
export function effectiveTableBuffet(
  selection: TableBuffetSelection | null,
): TableBuffetSelection | null {
  if (!selection) return null;
  const { adults, children } = normalizeBuffetGuestCounts(selection.adults, selection.children);
  if (adults <= 0 && children <= 0) return null;
  return { buffetId: selection.buffetId, adults, children };
}

function tableBuffetSelectionsEqual(
  a: TableBuffetSelection | null,
  b: TableBuffetSelection | null,
): boolean {
  const left = effectiveTableBuffet(a);
  const right = effectiveTableBuffet(b);
  if (!left || !right) return left === right;
  return (
    left.buffetId === right.buffetId
    && left.adults === right.adults
    && left.children === right.children
  );
}

export function isTableBuffetUnchanged(
  orders: Array<Pick<Order, 'items' | 'status'>>,
  target: TableBuffetSelection | null,
): boolean {
  return tableBuffetSelectionsEqual(currentTableBuffet(orders), target);
}

/** Draft would take a table that has buffet guests down to 0 adults + 0 children. */
export function buffetDraftClearsHeadcount(
  orders: Array<Pick<Order, 'items' | 'status'>>,
  draft: TableBuffetSelection | null,
): boolean {
  return effectiveTableBuffet(draft) == null && currentTableBuffet(orders) != null;
}

/** Void every active buffet line, then append the table's one new line (if any). */
export function applyTableBuffetLineToOrderItems(
  existingItems: OrderItem[],
  line: OrderItem | null,
): OrderItem[] {
  const voided = voidActiveBuffetBaseLines(existingItems);
  return line ? [...voided, line] : voided;
}

/**
 * Sole A/C string mint for staff / board / receipt (`A{n}` / `C{n}`).
 * KPI wings use adult/child fields; lists/pills join via {@link buffetHeadcountTokenParts}.
 */
export function buffetHeadcountTokens(
  adults: number,
  children: number,
): { adult: string | null; child: string | null } {
  const { adults: a, children: c } = normalizeBuffetGuestCounts(adults, children);
  return {
    adult: a > 0 ? `A${a}` : null,
    child: c > 0 ? `C${c}` : null,
  };
}

/** Adult-first token list — derived from {@link buffetHeadcountTokens}, never a second mint. */
export function buffetHeadcountTokenParts(adults: number, children: number): string[] {
  const { adult, child } = buffetHeadcountTokens(adults, children);
  return [adult, child].filter((part): part is string => part != null);
}

/** Staff order lists: spaced tokens (`A7 C3`, `A2`). */
export function formatBuffetHeadcountLabel(adults: number, children: number): string {
  return buffetHeadcountTokenParts(adults, children).join(' ');
}

/** Receipt qty column: hyphenated tokens (`A4-C2`, `A2`). */
export function formatBuffetReceiptQtyLabel(adults: number, children: number): string {
  return buffetHeadcountTokenParts(adults, children).join('-');
}

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
