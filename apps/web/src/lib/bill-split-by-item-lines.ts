import {
  billableLineAmount,
  billableRowFromCatalogLine,
  buildBillableSessionItems,
  byItemSplitTargetQty,
  chargeableFieldsFromBillableRow,
  isByItemSplittableBillableRow,
} from '@/lib/billable-session-lines';
import { isBuffetBaseItem } from '@/lib/order-items';
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

export function buildBillSplitOrderLines(orders: Order[]): BillSplitOrderLine[] {
  return buildBillableSessionItems(orders).map((row) => ({
    ...row.item,
    key: row.key,
    ...chargeableFieldsFromBillableRow(row),
  }));
}

export function buildByItemSplitOrderLines(orders: Order[]): BillSplitOrderLine[] {
  return buildBillableSessionItems(orders)
    .filter(isByItemSplittableBillableRow)
    .map((row) => ({
      ...row.item,
      key: row.key,
      ...chargeableFieldsFromBillableRow(row),
    }));
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
