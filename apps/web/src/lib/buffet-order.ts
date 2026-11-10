import type { Buffet, Order, OrderItem } from '@/types';
import { isBuffetBaseItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';

export type BuffetGuestCounts = { adults: number; children: number };

/**
 * The table's one buffet package + headcount (one table, one buffet).
 * Headcount may be 0 + 0; that does not clear the package — only the guest charge.
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
 * Normalize guest counts on a selection. null stays null.
 * 0 + 0 keeps `buffetId` — package is fixed; headcount alone may be zero.
 */
export function effectiveTableBuffet(
  selection: TableBuffetSelection | null,
): TableBuffetSelection | null {
  if (!selection) return null;
  const { adults, children } = normalizeBuffetGuestCounts(selection.adults, selection.children);
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
  const current = currentTableBuffet(orders);
  if (!current || totalGuestsFromCounts(current) <= 0) return false;
  const next = effectiveTableBuffet(draft);
  return !next || totalGuestsFromCounts(next) <= 0;
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
  | {
      ok: true;
      adultPrice: number;
      childPrice: number;
      /** Matched rule sells this side (off → never shown). */
      adultEnabled: boolean;
      childEnabled: boolean;
      subtotal: number;
    }
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
    adultEnabled: resolved.adult_enabled !== false,
    childEnabled: resolved.child_enabled !== false,
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
  /** From the matched price rule; missing (no rule / old payload) → true. */
  adult_enabled: boolean;
  child_enabled: boolean;
}

export function parseResolvedBuffetPriceRpcRow(priceRows: unknown): ResolvedBuffetPriceRow {
  const resolvedRow = Array.isArray(priceRows) ? priceRows[0] : priceRows;
  const row = resolvedRow as {
    adult_price?: unknown;
    child_price?: unknown;
    rule_id?: string | null;
    time_slot_id?: string | null;
    adult_enabled?: unknown;
    child_enabled?: unknown;
  } | null;
  return {
    adult_price: row?.adult_price != null ? Number(row.adult_price) : null,
    child_price: row?.child_price != null ? Number(row.child_price) : null,
    rule_id: row?.rule_id ?? null,
    time_slot_id: row?.time_slot_id ?? null,
    adult_enabled: row?.adult_enabled !== false,
    child_enabled: row?.child_enabled !== false,
  };
}

export const BUFFET_MIN_GUEST_COUNT = 'buffet_min_guest_count';
export const BUFFET_SIDE_DISABLED = 'buffet_side_disabled';

/** Per-table headcount rule: buffet minimum + the matched price rule's side toggles. */
export type BuffetGuestRule = {
  minGuestCount: number;
  adultEnabled: boolean;
  childEnabled: boolean;
};

export type BuffetGuestCountViolation =
  | { code: typeof BUFFET_SIDE_DISABLED; side: 'adults' | 'children' }
  | { code: typeof BUFFET_MIN_GUEST_COUNT; min: number; total: number };

/** Rule for one buffet: `min_guest_count` (missing → 0) + resolved toggles (missing → on). */
export function buffetGuestRuleFor(
  buffet: Pick<Buffet, 'min_guest_count'> | null | undefined,
  resolved: Pick<ResolvedBuffetPriceRow, 'adult_enabled' | 'child_enabled'> | null | undefined,
): BuffetGuestRule {
  const min = Number(buffet?.min_guest_count);
  return {
    minGuestCount: Number.isFinite(min) && min > 0 ? Math.floor(min) : 0,
    adultEnabled: resolved?.adult_enabled !== false,
    childEnabled: resolved?.child_enabled !== false,
  };
}

/**
 * Raise headcount to the package minimum when short — prefer adults if that side is on,
 * else children. Already at/above minimum is unchanged. Sole bump used by package pick.
 */
export function ensureTableBuffetDraftMinGuests(
  selection: TableBuffetSelection,
  rule: BuffetGuestRule,
): TableBuffetSelection {
  const { adults, children } = normalizeBuffetGuestCounts(selection.adults, selection.children);
  const next = { buffetId: selection.buffetId, adults, children };
  const need = rule.minGuestCount - (adults + children);
  if (need <= 0) return next;
  if (rule.adultEnabled) {
    next.adults = adults + need;
    return next;
  }
  if (rule.childEnabled) {
    next.children = children + need;
    return next;
  }
  return next;
}

/**
 * Sole package pick: headcount carries over; a side the package's rule disables → 0;
 * then raise to `min_guest_count` when short (prefer adults).
 */
export function selectTableBuffetDraft(
  prev: TableBuffetSelection | null,
  buffetId: string,
  resolved: Pick<ResolvedBuffetPriceRow, 'adult_enabled' | 'child_enabled'> | null | undefined,
  buffet?: Pick<Buffet, 'min_guest_count'> | null,
): TableBuffetSelection {
  const picked = {
    buffetId,
    adults: resolved?.adult_enabled === false ? 0 : (prev?.adults ?? 0),
    children: resolved?.child_enabled === false ? 0 : (prev?.children ?? 0),
  };
  return ensureTableBuffetDraftMinGuests(picked, buffetGuestRuleFor(buffet, resolved));
}

/** Rule for the draft's buffet among `buffets` + `resolvedByBuffetId`; null without a draft. */
export function buffetGuestRuleForDraft(
  draft: TableBuffetSelection | null,
  buffets: Array<Pick<Buffet, 'id' | 'min_guest_count'>>,
  resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null>,
): BuffetGuestRule | null {
  if (!draft) return null;
  return buffetGuestRuleFor(
    buffets.find((b) => b.id === draft.buffetId),
    resolvedByBuffetId[draft.buffetId],
  );
}

/**
 * Sole headcount-vs-rule check (server pipeline + open sheet / detail / checkout adjust).
 * Disabled side first (must be 0), then adults + children ≥ minimum.
 */
export function buffetGuestCountViolation(
  input: BuffetGuestRule & { adults: number; children: number },
): BuffetGuestCountViolation | null {
  const { adults, children } = normalizeBuffetGuestCounts(input.adults, input.children);
  if (!input.adultEnabled && adults > 0) return { code: BUFFET_SIDE_DISABLED, side: 'adults' };
  if (!input.childEnabled && children > 0) return { code: BUFFET_SIDE_DISABLED, side: 'children' };
  const total = adults + children;
  if (total < input.minGuestCount) {
    return { code: BUFFET_MIN_GUEST_COUNT, min: input.minGuestCount, total };
  }
  return null;
}

/** Server 409 `message` for a violation — parsed back by {@link parseBuffetGuestCountViolation}. */
export function formatBuffetGuestCountViolationMessage(v: BuffetGuestCountViolation): string {
  return v.code === BUFFET_SIDE_DISABLED ? `side=${v.side}` : `min=${v.min} total=${v.total}`;
}

/** Client: 409 code + message → violation (null when the code is not a headcount-rule code). */
export function parseBuffetGuestCountViolation(
  code: string | undefined,
  message: string | undefined,
): BuffetGuestCountViolation | null {
  if (code === BUFFET_SIDE_DISABLED) {
    return { code, side: /side=children/.test(message ?? '') ? 'children' : 'adults' };
  }
  if (code === BUFFET_MIN_GUEST_COUNT) {
    const m = /min=(\d+) total=(\d+)/.exec(message ?? '');
    return { code, min: m ? Number(m[1]) : 0, total: m ? Number(m[2]) : 0 };
  }
  return null;
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
