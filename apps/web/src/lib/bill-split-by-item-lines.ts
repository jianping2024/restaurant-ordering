import {
  billableLineAmount,
  billableRowFromCatalogLine,
  buildBillableSessionItems,
  byItemSplitTargetQty,
  chargeableFieldsFromBillableRow,
  isByItemSplittableBillableRow,
  type BillableSessionItem,
} from '@/lib/billable-session-lines';
import { isBuffetBaseItem } from '@/lib/order-items';
import { formatOrderItemQuantityLabel } from '@/lib/order-list-display';
import type { Order, OrderItem } from '@/types';

/** Billable catalog line for by-item split (same keys as receipt / bill details). */
export type BillSplitOrderLine = OrderItem & {
  key: string;
  order_id?: string;
  chargeableQty?: number;
  chargeableUnitPrice?: number;
};

export type ByItemSplitLine = {
  key: string;
  name: string;
} & (
  | { mode: 'menu'; qty: number; unitPrice: number }
  | {
      mode: 'buffet';
      adults: number;
      children: number;
      adultUnitPrice: number;
      childUnitPrice: number;
    }
);

export type ByItemLineSpec =
  | {
      mode: 'menu';
      key: string;
      lineQty: number;
      lineTotal: number;
      unitPrice: number;
    }
  | {
      mode: 'buffet';
      key: string;
      lineTotal: number;
      adults: number;
      children: number;
      adultUnitPrice: number;
      childUnitPrice: number;
    };

function billSplitOrderLineFromBillableRow(row: BillableSessionItem): BillSplitOrderLine {
  return {
    ...row.item,
    key: row.key,
    ...chargeableFieldsFromBillableRow(row),
  };
}

/** Full bill catalog (physical qty; used for bill details and receipt aggregation). */
export function buildBillSplitOrderLines(orders: Order[]): BillSplitOrderLine[] {
  return buildBillableSessionItems(orders).map(billSplitOrderLineFromBillableRow);
}

/** Splittable subset for by-item allocation (limited rows use chargeable qty in specs). */
export function buildByItemSplitOrderLines(orders: Order[]): BillSplitOrderLine[] {
  return buildBillableSessionItems(orders)
    .filter(isByItemSplittableBillableRow)
    .map(billSplitOrderLineFromBillableRow);
}

/** Quantity label for by-item split cards — menu lines use {@link ByItemLineSpec.lineQty}. */
export function formatByItemSplitQuantityLabel(
  spec: ByItemLineSpec,
  catalogLine: BillSplitOrderLine,
): string {
  if (spec.mode === 'buffet') {
    return formatOrderItemQuantityLabel(catalogLine, { headcountStyle: 'receipt' });
  }
  return formatOrderItemQuantityLabel({ ...catalogLine, qty: spec.lineQty }, {
    headcountStyle: 'receipt',
  });
}

export function buildByItemLineSpec(line: BillSplitOrderLine): ByItemLineSpec {
  const billableRow = billableRowFromCatalogLine(line);
  const lineTotal = billableLineAmount(billableRow);
  const lineQty = byItemSplitTargetQty(billableRow);
  if (isBuffetBaseItem(line)) {
    return {
      mode: 'buffet',
      key: line.key,
      lineTotal,
      adults: Math.max(0, line.adult_count ?? 0),
      children: Math.max(0, line.child_count ?? 0),
      adultUnitPrice: line.adult_unit_price ?? 0,
      childUnitPrice: line.child_unit_price ?? 0,
    };
  }
  return {
    mode: 'menu',
    key: line.key,
    lineQty,
    lineTotal,
    unitPrice: lineQty > 0 ? lineTotal / lineQty : line.price,
  };
}

export function buildByItemLineSpecs(lines: BillSplitOrderLine[]): ByItemLineSpec[] {
  return lines.map(buildByItemLineSpec);
}

export function byItemSplitLineFromOrderLine(
  line: BillSplitOrderLine,
  displayName: string,
): ByItemSplitLine {
  const spec = buildByItemLineSpec(line);
  if (spec.mode === 'buffet') {
    return {
      key: spec.key,
      name: displayName,
      mode: 'buffet',
      adults: spec.adults,
      children: spec.children,
      adultUnitPrice: spec.adultUnitPrice,
      childUnitPrice: spec.childUnitPrice,
    };
  }
  return {
    key: spec.key,
    name: displayName,
    mode: 'menu',
    qty: spec.lineQty,
    unitPrice: spec.unitPrice,
  };
}
