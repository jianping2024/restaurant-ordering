import type { Buffet, Order, OrderItem } from '@/types';
import { isBuffetBaseItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';

export type BuffetGuestCounts = { adults: number; children: number };

/** Active buffet packages on a table: buffetId → headcount (omits all-zero packages). */
export type BuffetGuestSnapshot = Record<string, BuffetGuestCounts>;

export type BuffetGuestEntry = {
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

/** Mark active buffet_base lines for one package void. */
export function voidBuffetBaseLinesForBuffetId(items: OrderItem[], buffetId: string): OrderItem[] {
  const voidedAt = new Date().toISOString();
  return items.map((item) => {
    if (!isBuffetBaseItem(item)) return item;
    if (item.buffet_id !== buffetId) return item;
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

export function buffetSnapshotFromOrders(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): BuffetGuestSnapshot {
  const snapshot: BuffetGuestSnapshot = {};
  for (const [buffetId, line] of Array.from(activeBuffetLineByBuffetId(orders).entries())) {
    snapshot[buffetId] = {
      adults: line.adult_count ?? 0,
      children: line.child_count ?? 0,
    };
  }
  return snapshot;
}

export function hasActiveBuffetForOrders(orders: Array<Pick<Order, 'items' | 'status'>>): boolean {
  return listActiveBuffetBaseLines(orders).length > 0;
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

/** @deprecated Use aggregateBuffetHeadcountForOrders or listActiveBuffetLineSummaries. */
export function aggregateBuffetForOrders(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): {
  buffetId: string;
  name: string;
  adults: number;
  children: number;
  amount: number;
} | null {
  const summaries = listActiveBuffetLineSummaries(orders);
  if (summaries.length === 0) return null;
  const headcount = aggregateBuffetHeadcountForOrders(orders)!;
  return {
    buffetId: summaries[0].buffetId,
    name: summaries.length === 1 ? summaries[0].name : summaries.map((s) => s.name).join(' + '),
    adults: headcount.adults,
    children: headcount.children,
    amount: summaries.reduce((sum, row) => sum + row.amount, 0),
  };
}

export const IDLE_BUFFET_FORM_DEFAULTS = { adults: 2, children: 0 } as const;

export function buildIdleBuffetDraftSnapshot(
  activeBuffetIds: string[],
  defaultBuffetId: string | null,
): BuffetGuestSnapshot {
  const snapshot: BuffetGuestSnapshot = {};
  for (const buffetId of activeBuffetIds) {
    if (buffetId === defaultBuffetId) {
      snapshot[buffetId] = { ...IDLE_BUFFET_FORM_DEFAULTS };
    } else {
      snapshot[buffetId] = { adults: 0, children: 0 };
    }
  }
  return snapshot;
}

export function deriveBuffetFormSnapshot(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): BuffetGuestSnapshot {
  return buffetSnapshotFromOrders(orders);
}

export type BuffetFormAlignState =
  | { mode: 'pending' }
  | { mode: 'idle'; defaultBuffetId: string | null; activeBuffetIds: string[] }
  | { mode: 'occupied'; snapshot: BuffetGuestSnapshot };

export function resolveBuffetFormAlignState(input: {
  detailLoaded: boolean;
  orders: Array<Pick<Order, 'items' | 'status'>>;
  activeBuffetIds: string[];
  defaultBuffetId: string | null;
}): BuffetFormAlignState {
  if (!input.detailLoaded) {
    return { mode: 'pending' };
  }

  const snapshot = deriveBuffetFormSnapshot(input.orders);
  if (Object.keys(snapshot).length > 0) {
    return { mode: 'occupied', snapshot };
  }

  return {
    mode: 'idle',
    defaultBuffetId: input.defaultBuffetId,
    activeBuffetIds: input.activeBuffetIds,
  };
}

export function buffetSnapshotKey(snapshot: BuffetGuestSnapshot): string {
  return Object.entries(snapshot)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, counts]) => `${id}:${counts.adults}:${counts.children}`)
    .join('|');
}

export function buffetFormAlignKey(
  tableId: string,
  sessionId: string | null,
  align: BuffetFormAlignState,
): string {
  const sessionKey = sessionId ?? 'none';
  if (align.mode === 'pending') {
    return `${tableId}:${sessionKey}:pending`;
  }
  if (align.mode === 'idle') {
    return `${tableId}:${sessionKey}:idle:${align.defaultBuffetId ?? ''}:${align.activeBuffetIds.join(',')}`;
  }
  return `${tableId}:${sessionKey}:occupied:${buffetSnapshotKey(align.snapshot)}`;
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

export function normalizeBuffetGuestEntries(
  buffets: Array<{ buffet_id: string; adult_count: number; child_count: number }>,
): BuffetGuestEntry[] {
  return buffets.map((row) => {
    const { adults, children } = normalizeBuffetGuestCounts(row.adult_count, row.child_count);
    return { buffetId: row.buffet_id, adults, children };
  });
}

export function snapshotFromBuffetEntries(entries: BuffetGuestEntry[]): BuffetGuestSnapshot {
  const snapshot: BuffetGuestSnapshot = {};
  for (const entry of entries) {
    if (entry.adults <= 0 && entry.children <= 0) continue;
    snapshot[entry.buffetId] = { adults: entry.adults, children: entry.children };
  }
  return snapshot;
}

export function buffetSnapshotsEqual(a: BuffetGuestSnapshot, b: BuffetGuestSnapshot): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i += 1) {
    if (keysA[i] !== keysB[i]) return false;
    const left = a[keysA[i]];
    const right = b[keysB[i]];
    if (left.adults !== right.adults || left.children !== right.children) return false;
  }
  return true;
}

export function isBuffetSnapshotUnchanged(
  orders: Array<Pick<Order, 'items' | 'status'>>,
  targetSnapshot: BuffetGuestSnapshot,
): boolean {
  return buffetSnapshotsEqual(buffetSnapshotFromOrders(orders), targetSnapshot);
}

export type BuffetSnapshotDiff = {
  voidBuffetIds: string[];
  upsertBuffetIds: string[];
};

export function diffBuffetSnapshots(
  current: BuffetGuestSnapshot,
  target: BuffetGuestSnapshot,
): BuffetSnapshotDiff {
  const voidBuffetIds: string[] = [];
  const upsertBuffetIds: string[] = [];
  const ids = new Set([...Object.keys(current), ...Object.keys(target)]);

  for (const buffetId of Array.from(ids)) {
    const from = current[buffetId];
    const to = target[buffetId];
    if (!to) {
      if (from) voidBuffetIds.push(buffetId);
      continue;
    }
    if (!from || from.adults !== to.adults || from.children !== to.children) {
      upsertBuffetIds.push(buffetId);
    }
  }

  return { voidBuffetIds, upsertBuffetIds };
}

export function upsertBuffetLineOntoOrderItems(
  existingItems: OrderItem[],
  newLine: OrderItem,
): OrderItem[] {
  const buffetId = newLine.buffet_id;
  if (!buffetId) return existingItems;
  const voided = voidBuffetBaseLinesForBuffetId(existingItems, buffetId);
  return [...voided, newLine];
}

export function applyBuffetLinesToOrderItems(
  existingItems: OrderItem[],
  lines: OrderItem[],
  voidBuffetIds: string[],
): OrderItem[] {
  let items = existingItems;
  for (const buffetId of voidBuffetIds) {
    items = voidBuffetBaseLinesForBuffetId(items, buffetId);
  }
  for (const line of lines) {
    items = upsertBuffetLineOntoOrderItems(items, line);
  }
  return items;
}

export function formatBuffetHeadcountLabel(adults: number, children: number): string {
  return `A${adults} C${children}`;
}

export function formatBuffetCompactHeadcountLabel(adults: number, children: number): string {
  const { adults: a, children: c } = normalizeBuffetGuestCounts(adults, children);
  let out = '';
  if (a > 0) out += `A${a}`;
  if (c > 0) out += `C${c}`;
  return out;
}

export function formatBuffetReceiptQtyLabel(adults: number, children: number): string {
  const { adults: a, children: c } = normalizeBuffetGuestCounts(adults, children);
  if (a > 0 && c > 0) return `A${a}-C${c}`;
  if (a > 0) return `A${a}`;
  if (c > 0) return `C${c}`;
  return '';
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

export type BuffetPackagesPricePreview =
  | { ok: true; subtotal: number }
  | { ok: false; missingBuffetId?: string };

export function resolveBuffetPackagesPricePreview(
  snapshot: BuffetGuestSnapshot,
  resolvedByBuffetId: Record<string, ResolvedBuffetPriceRow | null>,
): BuffetPackagesPricePreview {
  let subtotal = 0;
  for (const [buffetId, counts] of Object.entries(snapshot)) {
    if (counts.adults <= 0 && counts.children <= 0) continue;
    const preview = resolveBuffetOpenPricePreview(resolvedByBuffetId[buffetId] ?? null, counts.adults, counts.children);
    if (!preview.ok) {
      return { ok: false, missingBuffetId: buffetId };
    }
    subtotal += preview.subtotal;
  }
  return { ok: true, subtotal };
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

export function buffetEntriesFromSnapshot(
  snapshot: BuffetGuestSnapshot,
  activeBuffetIds: string[],
): BuffetGuestEntry[] {
  return activeBuffetIds.map((buffetId) => ({
    buffetId,
    adults: snapshot[buffetId]?.adults ?? 0,
    children: snapshot[buffetId]?.children ?? 0,
  }));
}

export function hasPositiveBuffetSnapshot(snapshot: BuffetGuestSnapshot): boolean {
  return Object.values(snapshot).some((counts) => counts.adults > 0 || counts.children > 0);
}
