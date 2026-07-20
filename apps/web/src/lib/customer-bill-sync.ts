import {
  buildBillSplitOrderLines,
  buildByItemLineSpecs,
} from '@/lib/bill-split-by-item-lines';
import { requestCustomerBillContext } from '@/lib/request-customer-context';
import type { Order } from '@/types';

/** Stable fingerprint for bill-page order completeness checks. */
export function billOrdersFingerprint(orders: Order[]): string {
  return orders
    .map((order) => {
      const items = (order.items || [])
        .map(
          (item, idx) =>
            `${idx}:${item.qty}:${item.price}:${item.kind ?? ''}:${item.adult_count ?? ''}:${item.child_count ?? ''}`,
        )
        .join(',');
      return `${order.id}|${items}`;
    })
    .join(';');
}

export function isBillOrdersComplete(displayed: Order[], fresh: Order[]): boolean {
  return billOrdersFingerprint(displayed) === billOrdersFingerprint(fresh);
}

export function deriveBillView(orders: Order[]) {
  const orderLines = buildBillSplitOrderLines(orders);
  const lineSpecs = buildByItemLineSpecs(orderLines);
  const total = orderLines.reduce((sum, item) => sum + item.price * item.qty, 0);
  return { orderLines, lineSpecs, total };
}

export async function syncCustomerBill(slug: string, tableId: string) {
  const data = await requestCustomerBillContext(slug, tableId, 'live');
  if (!data) return null;
  const orders = (data.orders || []) as Order[];
  const partyMemberCount =
    typeof data.party_member_count === 'number' && Number.isFinite(data.party_member_count)
      ? Math.max(0, Math.trunc(data.party_member_count))
      : 0;
  return { orders, partyMemberCount, ...deriveBillView(orders) };
}
