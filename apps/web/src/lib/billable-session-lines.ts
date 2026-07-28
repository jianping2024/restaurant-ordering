import {
  activeBuffetLineByBuffetId,
  listActiveBuffetLineSummaries,
} from '@/lib/buffet-order';
import { lineTotal } from '@/lib/cart-totals';
import { isBuffetBaseItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import {
  allocateSessionSushiLimitedLines,
  sushiLimitedLineKey,
} from '@/lib/sushi-buffet-limits';
import type { Order, OrderItem } from '@/types';

export type BillableSessionItem = {
  key: string;
  item: OrderItem;
  /**
   * Sushi limited dish: how many of `item.qty` are billed beyond the free allowance.
   * Display stays one row; money uses {@link billableLineAmount}.
   */
  chargeableQty?: number;
  chargeableUnitPrice?: number;
};

/** Merge key for billable menu lines (notes ignored). */
export function billableMenuItemMergeKey(item: OrderItem): string {
  return `${item.id}::${item.price}`;
}

/** Sushi limited dishes merge under `limited:{menuItemId}` (see {@link addLimitedMenuGroup}). */
export function isLimitedBillableRow(row: Pick<BillableSessionItem, 'key'>): boolean {
  return row.key.startsWith('limited:');
}

/**
 * Line money. Unlimited menu rows: qty × unit price. Limited sushi rows: only the
 * chargeable share is billed (free allowance portions are €0 on read paths).
 */
export function billableLineAmount(row: BillableSessionItem): number {
  if (isLimitedBillableRow(row)) {
    const share = chargeableShareOf(row);
    return share ? share.qty * share.unitPrice : 0;
  }
  return lineTotal(row.item);
}

/** Non-null when this catalog row has a chargeable share beyond the free allowance. */
export function chargeableShareOf(
  row: Pick<BillableSessionItem, 'chargeableQty' | 'chargeableUnitPrice'>,
): { qty: number; unitPrice: number } | null {
  const qty = row.chargeableQty ?? 0;
  if (qty <= 0 || row.chargeableUnitPrice == null) return null;
  return { qty, unitPrice: row.chargeableUnitPrice };
}

type MergedMenuGroup = {
  item: OrderItem;
  qty: number;
  chargeableQty: number;
  chargeableUnitPrice: number | null;
};

function addUnlimitedMenuGroup(
  merged: Map<string, MergedMenuGroup>,
  item: OrderItem,
  qty: number,
): void {
  const key = billableMenuItemMergeKey(item);
  const existing = merged.get(key);
  if (existing) {
    existing.qty += qty;
    return;
  }
  merged.set(key, {
    item,
    qty,
    chargeableQty: 0,
    chargeableUnitPrice: null,
  });
}

/**
 * One catalog row per limited dish. Unit price on the row is the free/menu price;
 * chargeable qty is metadata only (no free/overage split in the list).
 */
function addLimitedMenuGroup(
  merged: Map<string, MergedMenuGroup>,
  item: OrderItem,
  qty: number,
  freeQty: number,
  chargeableQty: number,
  chargeableUnitPrice: number,
): void {
  const key = `limited:${item.id}`;
  const existing = merged.get(key);
  // Free-priced row (or pre-freeze single line) carries the menu unit; a post-freeze
  // fully-chargeable row is priced at overage and must not overwrite the menu unit.
  const menuUnitPrice =
    freeQty > 0 || item.price !== chargeableUnitPrice
      ? Number(item.price)
      : existing
        ? Number(existing.item.price)
        : 0;

  if (existing) {
    existing.qty += qty;
    existing.chargeableQty += chargeableQty;
    if (freeQty > 0) {
      existing.item = { ...existing.item, price: menuUnitPrice };
    }
    return;
  }

  merged.set(key, {
    item: { ...item, price: menuUnitPrice },
    qty,
    chargeableQty,
    chargeableUnitPrice,
  });
}

/**
 * Active billable lines for checkout detail, receipts, bill splits, and session totals.
 * Sushi limited dishes stay **one** catalog row (no free/overage split); chargeable
 * qty is metadata for hints and {@link billableLineAmount}. Stored orders are unchanged.
 */
export function buildBillableSessionItems(orders: Order[]): BillableSessionItem[] {
  const lines: BillableSessionItem[] = [];
  const buffetSummaries = listActiveBuffetLineSummaries(orders);
  const buffetLineById = activeBuffetLineByBuffetId(orders);
  const limitAllocations = allocateSessionSushiLimitedLines(orders);

  for (const summary of buffetSummaries) {
    const template = buffetLineById.get(summary.buffetId);
    if (!template) continue;
    lines.push({
      key: `buffet:${summary.buffetId}`,
      item: {
        ...template,
        adult_count: summary.adults,
        child_count: summary.children,
        price: summary.amount,
        qty: 1,
      },
    });
  }

  const mergedMenu = new Map<string, MergedMenuGroup>();
  for (const order of orders) {
    const items = order.items || [];
    for (let itemIdx = 0; itemIdx < items.length; itemIdx += 1) {
      const item = items[itemIdx];
      const st = normalizeOrderItemStatus(item, order.status);
      if (st === 'voided') continue;
      if (isBuffetBaseItem(item) && buffetSummaries.length > 0) continue;

      const allocation = limitAllocations.get(sushiLimitedLineKey(order.id, itemIdx));
      if (!allocation) {
        addUnlimitedMenuGroup(mergedMenu, item, item.qty);
        continue;
      }

      addLimitedMenuGroup(
        mergedMenu,
        item,
        Math.max(0, Number(item.qty) || 0),
        allocation.freeQty,
        allocation.chargeableQty,
        allocation.chargeableUnitPrice,
      );
    }
  }

  for (const [mergeKey, group] of Array.from(mergedMenu.entries())) {
    const row: BillableSessionItem = {
      key: mergeKey,
      item: { ...group.item, qty: group.qty },
    };
    if (group.chargeableQty > 0 && group.chargeableUnitPrice != null) {
      row.chargeableQty = group.chargeableQty;
      row.chargeableUnitPrice = group.chargeableUnitPrice;
    }
    lines.push(row);
  }

  return lines;
}

/** Session billable total — same basis as bill details, receipts, and checkout. */
export function sumBillableSessionTotal(orders: Order[]): number {
  return buildBillableSessionItems(orders).reduce(
    (sum, row) => sum + billableLineAmount(row),
    0,
  );
}
