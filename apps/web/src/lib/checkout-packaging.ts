/**
 * Checkout packaging supply (外卖耗材) — staff picks a packaging menu item + qty.
 * Sole line shape: OrderItem kind `packaging` via {@link buildPackagingChargeItem}.
 */
import type { Order, OrderItem } from '@/types';
import { applyOrderItemDecrement } from '@/lib/order-item-void/decrement-order-item';
import { isPackagingChargeItem } from '@/lib/order-items';

export const PACKAGING_ID_PREFIX = 'packaging:';
export const PACKAGING_QTY_MAX = 99;
export const PACKAGING_LINES_MAX = 20;

export type PackagingLineInput = {
  menuItemId: string;
  qty: number;
};

/** Integer qty 1..PACKAGING_QTY_MAX; else null. */
export function parsePackagingQty(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > PACKAGING_QTY_MAX) return null;
  return n;
}

/**
 * Sole POST body parser: `lines: [{ menu_item_id, qty }, …]`.
 * Invalid / empty / over max → null.
 */
export function parsePackagingLines(body: unknown): PackagingLineInput[] | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const raw = (body as Record<string, unknown>).lines;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > PACKAGING_LINES_MAX) return null;
  const lines: PackagingLineInput[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const row = entry as Record<string, unknown>;
    const menuItemId =
      typeof row.menu_item_id === 'string' ? row.menu_item_id.trim() : '';
    const qty = parsePackagingQty(row.qty);
    if (!menuItemId || qty == null) return null;
    lines.push({ menuItemId, qty });
  }
  return lines;
}

/** Sole packaging line builder (server writes into orders.items). */
export function buildPackagingChargeItem(input: {
  lineId: string;
  namePt: string;
  nameEn?: string | null;
  nameZh?: string | null;
  unitPrice: number;
  qty: number;
  batchId: string;
  addedAt: string;
  emoji?: string | null;
  itemCode?: string | null;
}): OrderItem {
  const name_pt = input.namePt.trim() || '—';
  return {
    id: `${PACKAGING_ID_PREFIX}${input.lineId}`,
    kind: 'packaging',
    name: name_pt,
    name_pt,
    name_en: input.nameEn?.trim() || name_pt,
    name_zh: input.nameZh?.trim() || name_pt,
    qty: input.qty,
    price: input.unitPrice,
    emoji:
      typeof input.emoji === 'string' && input.emoji
        ? input.emoji.slice(0, 8)
        : '📦',
    // Supply line — not kitchen work.
    item_status: 'done',
    batch_id: input.batchId,
    added_at: input.addedAt,
    item_code: input.itemCode?.trim() || null,
  };
}

/**
 * Sole local void of one packaging supply line (optimistic UI before DELETE settles).
 * Missing / not voidable → null.
 */
export function voidPackagingChargeInOrders(orders: Order[], lineId: string): Order[] | null {
  const id = lineId.trim();
  if (!id.startsWith(PACKAGING_ID_PREFIX)) return null;

  for (let orderIndex = 0; orderIndex < orders.length; orderIndex++) {
    const order = orders[orderIndex]!;
    const items = order.items ?? [];
    const itemIndex = items.findIndex((item) => item.id === id && isPackagingChargeItem(item));
    if (itemIndex < 0) continue;
    const result = applyOrderItemDecrement(items, itemIndex, order.status);
    if (!result.ok) return null;
    return orders.map((row, i) => (i === orderIndex ? { ...row, items: result.nextItems } : row));
  }
  return null;
}
