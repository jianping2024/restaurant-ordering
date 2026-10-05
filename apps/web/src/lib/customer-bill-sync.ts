import type { IndividualTicketInfo } from '@/lib/individual-checkout';
import {
  buildBillSplitOrderLines,
  buildByItemSplitOrderLines,
  buildByItemLineSpecs,
} from '@/lib/bill-split-by-item-lines';
import { sumBillableSessionTotal } from '@/lib/billable-session-lines';
import { requestCustomerBillContext } from '@/lib/request-customer-context';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { BillSplit, Order, SessionStatus } from '@/types';

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

/**
 * Bill-page read model: full catalog (`orderLines`, occupancy/feedback) vs by-item money pool
 * (`splitOrderLines` / `lineSpecs` — paper gate). Screen bill details use
 * `checkoutLinesFromOrders` (same paper gate). Totals via {@link sumBillableSessionTotal}.
 */
export function deriveBillView(orders: Order[]) {
  const orderLines = buildBillSplitOrderLines(orders);
  const splitOrderLines = buildByItemSplitOrderLines(orders);
  const lineSpecs = buildByItemLineSpecs(splitOrderLines);
  const total = sumBillableSessionTotal(orders);
  return { orderLines, splitOrderLines, lineSpecs, total };
}

/** Sole client bill reconcile snapshot — same fields as SSR / customer/bill full. */
export type CustomerBillSyncSnapshot = {
  /** Session stamped individual_checkout — guests call per ticket, the table never locks. */
  individualCheckout: boolean;
  individualTickets: IndividualTicketInfo[];
  orders: Order[];
  partyMemberCount: number;
  existingSplit: BillSplit | null;
  collectedPayments: SessionCollectedPayment[];
  /** Live open-session id — sole owner key for bill-split local draft hydrate/persist. */
  sessionId: string | null;
  sessionStatus: SessionStatus | null;
  orderLines: ReturnType<typeof deriveBillView>['orderLines'];
  splitOrderLines: ReturnType<typeof deriveBillView>['splitOrderLines'];
  lineSpecs: ReturnType<typeof deriveBillView>['lineSpecs'];
  total: number;
};

/**
 * Sole customer bill client refresh: always `full` scope (orders + split + ledger + session).
 * Do not call with `live` — that half-model is removed; soft menu→bill must match hard refresh.
 */
export async function syncCustomerBill(
  slug: string,
  tableId: string,
  guestClientId?: string | null,
): Promise<CustomerBillSyncSnapshot | null> {
  const data = await requestCustomerBillContext(slug, tableId, 'full', guestClientId);
  if (!data) return null;
  const orders = (data.orders || []) as Order[];
  const partyMemberCount =
    typeof data.party_member_count === 'number' && Number.isFinite(data.party_member_count)
      ? Math.max(0, Math.trunc(data.party_member_count))
      : 0;
  const sessionStatus = (data.active_session?.status as SessionStatus | undefined) ?? null;
  const sessionId =
    typeof data.active_session?.id === 'string' && data.active_session.id.trim()
      ? data.active_session.id
      : null;
  return {
    individualCheckout: data.active_session?.individual_checkout === true,
    individualTickets: data.individual_tickets ?? [],
    orders,
    partyMemberCount,
    existingSplit: data.existing_split ?? null,
    collectedPayments: data.collected_payments ?? [],
    sessionId,
    sessionStatus,
    ...deriveBillView(orders),
  };
}
