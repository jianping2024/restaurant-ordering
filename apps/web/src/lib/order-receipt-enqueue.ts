import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillSplit, Order, OrderItem, PrintJobType } from '@/types';
import {
  formatBuffetReceiptQtyLabel,
} from '@/lib/buffet-order';
import { buildBillableSessionItems } from '@/lib/billable-session-lines';
import { isBuffetBaseItem } from '@/lib/order-items';
import { isRestaurantFeatureEnabled } from '@/lib/restaurant-features';
import {
  byItemLinePriceShare,
  buffetShareUnitPrice,
  consumersForLineFromPersons,
  legacyAssigneeIdsForKey,
  legacyEqualLineShare,
  legacyEqualShareQtyLabel,
  shareQtyLabel,
} from '@/lib/bill-split-by-item';
import { buildBillSplitOrderLines, buildByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { orderItemReceiptLineLabel } from '@/lib/menu-print-label';
import { checkoutPayableAmount } from '@/lib/checkout-split-math';
import { receiptPayerNameForPrint } from '@/lib/receipt-payer-label';
import {
  formatStationTicketOrderTime,
  guestCountFromTableOrders,
  stationTicketOrderTimeIso,
} from '@/lib/table-guest-count';

export type ReceiptVariant = 'pre_bill' | 'checkout_bill' | 'split_payment' | 'final';

/** Who triggered the print — only `automatic` is gated by bill_receipt_print. */
export type ReceiptPrintSource = 'automatic' | 'staff_manual';

/** Variants triggered by customer checkout flows; gated when printSource is automatic. */
const AUTOMATIC_BILL_RECEIPT_VARIANTS = new Set<ReceiptVariant>([
  'pre_bill',
  'split_payment',
  'final',
]);

export type OrderReceiptJobPayload = {
  order_id: string;
  locale: 'zh' | 'en' | 'pt';
  /** Agent routing id: cashier | station:{print_station_id} */
  receipt_printer_id?: string;
  receipt_variant: ReceiptVariant;
  table_id: string;
  display_name: string;
  guest_count?: number;
  payer_name?: string;
  order_time?: string;
  print_time?: string;
  subtotal: number;
  amount_due: number;
  amount_paid?: number;
  payment_method?: string;
  ordered_by?: string;
  /** Checkout confirm dedup; ignored by print agent */
  idempotency_key?: string;
  lines: Array<{
    item_index: number;
    display_name: string;
    qty: number;
    unit_price: number;
    note?: string;
    /** by_item split receipts: person's share of dish qty (e.g. 1/3) for thermal Qty column */
    share_qty_label?: string;
  }>;
};

function buffetReceiptShareQtyLabel(item: OrderItem): string | undefined {
  if (!isBuffetBaseItem(item)) return undefined;
  const label = formatBuffetReceiptQtyLabel(item.adult_count ?? 0, item.child_count ?? 0);
  return label || undefined;
}

function receiptLineFromOrderItem(item: OrderItem, itemIndex: number): OrderReceiptJobPayload['lines'][number] {
  const share_qty_label = buffetReceiptShareQtyLabel(item);
  return {
    item_index: itemIndex,
    display_name: orderItemReceiptLineLabel(item),
    qty: item.qty,
    unit_price: item.price,
    ...(share_qty_label ? { share_qty_label } : {}),
  };
}

/** Merge key for billable menu lines (notes ignored). */
export { billableMenuItemMergeKey as receiptMenuItemMergeKey } from '@/lib/billable-session-lines';

export function buildReceiptLinesFromOrders(
  orders: Order[],
): OrderReceiptJobPayload['lines'] {
  const lines: OrderReceiptJobPayload['lines'] = [];
  let itemIndex = 0;

  for (const { item } of buildBillableSessionItems(orders)) {
    itemIndex += 1;
    lines.push(receiptLineFromOrderItem(item, itemIndex));
  }

  return lines;
}

/** Lines for one split row (by-item); empty for even/custom → amount-only slip. */
export function buildSplitPersonReceiptLines(
  split: BillSplit,
  personIndex: number,
  orders: Order[],
): OrderReceiptJobPayload['lines'] {
  if (split.split_mode !== 'by_item') return [];

  const person = split.persons?.[personIndex];
  if (!person) return [];

  const persons = split.persons || [];
  const personId = `p${personIndex + 1}`;
  const catalogLines = buildBillSplitOrderLines(orders);
  const lines: OrderReceiptJobPayload['lines'] = [];
  let itemIndex = 0;

  for (const catalogLine of catalogLines) {
    const key = catalogLine.key;
    const hasLine = person.item_shares?.some((share) => share.key === key)
      || (person.items || []).includes(key);
    if (!hasLine) continue;

    const spec = buildByItemLineSpec(catalogLine);
    const consumers = consumersForLineFromPersons(persons, key, spec);
    if (consumers.length === 0) continue;

    const lineTotal = catalogLine.price * catalogLine.qty;
    const personShare = consumers.find((consumer) => consumer.name === person.name);
    if (!personShare) continue;

    const usesLegacyShares = !person.item_shares?.some((share) => share.key === key);
    const shareQty = personShare.qty.num / personShare.qty.den;
    const sharePrice = usesLegacyShares
      ? legacyEqualLineShare(lineTotal, legacyAssigneeIdsForKey(persons, key), personId)
      : spec.mode === 'buffet' && personShare.guestType
        ? buffetShareUnitPrice(catalogLine, personShare.guestType) * shareQty
        : byItemLinePriceShare(lineTotal, consumers, person.name);
    const shareLabel = usesLegacyShares
      ? legacyEqualShareQtyLabel(catalogLine.qty, consumers.length)
      : spec.mode === 'buffet' && personShare.guestType
        ? shareQtyLabel(personShare.qty)
        : shareQtyLabel(personShare.qty);

    itemIndex += 1;
    lines.push({
      item_index: itemIndex,
      display_name: orderItemReceiptLineLabel(catalogLine),
      qty: 1,
      unit_price: sharePrice,
      share_qty_label: shareLabel,
    });
  }
  return lines;
}

/** Stable key for checkout split/final receipt jobs (phase 4 dedup). */
export function checkoutReceiptIdempotencyKey(
  variant: ReceiptVariant,
  billSplitId: string,
  personIndex?: number,
  collectedPaymentId?: string | null,
): string | undefined {
  if (variant === 'split_payment' && personIndex != null && personIndex >= 0) {
    const paymentSuffix = collectedPaymentId?.trim()
      ? `:payment:${collectedPaymentId.trim()}`
      : '';
    return `checkout:${billSplitId}:split:${personIndex}${paymentSuffix}`;
  }
  if (variant === 'final') {
    return `checkout:${billSplitId}:final`;
  }
  return undefined;
}

async function findCheckoutReceiptJobId(
  admin: SupabaseClient,
  restaurantId: string,
  idempotencyKey: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('print_jobs')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('type', 'order_receipt')
    .in('status', ['pending', 'processing', 'done'])
    .eq('payload->>idempotency_key', idempotencyKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data.id as string;
}

type EnqueueParams = {
  admin: SupabaseClient;
  restaurantId: string;
  printLocale: string | null;
  sessionId: string;
  tableId: string;
  tableDisplayName: string;
  variant: ReceiptVariant;
  payerName?: string;
  personAmount?: number;
  billSplitId?: string;
  personIndex?: number;
  amountPaid?: number;
  paymentMethod?: string;
  /** From checkout picker: `cashier` or `station:{print_station_id}` */
  receiptPrinterId?: string;
  /** Bill snapshot order ids; falls back to bill_splits.order_ids when billSplitId is set */
  orderIds?: string[];
  /** Ledger row id for split_payment dedup across continuation collections */
  collectedPaymentId?: string | null;
  /** Checkout dashboard discount % for checkout_bill (matches「应收」). */
  discountRate?: number;
  /** Default `automatic` — staff dashboard manual print passes `staff_manual`. */
  printSource?: ReceiptPrintSource;
};

/** Load session orders for receipt printing (no table_number filter — avoids missing merged/transferred orders). */
export async function loadOrdersForReceiptPrint(
  admin: SupabaseClient,
  restaurantId: string,
  sessionId: string,
  orderIds?: string[],
): Promise<{ orders: Order[] | null; error: string | null }> {
  let query = admin
    .from('orders')
    .select('id, status, items, created_at, updated_at')
    .eq('restaurant_id', restaurantId);

  const ids = orderIds?.filter(Boolean);
  if (ids?.length) {
    query = query.in('id', ids);
  } else {
    query = query.eq('session_id', sessionId);
  }

  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) return { orders: null, error: error.message };
  return { orders: (data || []) as Order[], error: null };
}

export async function enqueueReceiptPrint(
  params: EnqueueParams,
): Promise<
  | { ok: true; job_id: string; deduped?: boolean }
  | { ok: true; skipped: true }
  | { ok: false; status: number; code: string; message?: string }
> {
  const {
    admin,
    restaurantId,
    printLocale,
    sessionId,
    tableId,
    tableDisplayName,
    variant,
    payerName,
    personAmount,
    billSplitId,
    personIndex,
    amountPaid,
    paymentMethod,
    receiptPrinterId,
    orderIds: orderIdsParam,
    discountRate = 0,
    collectedPaymentId,
    printSource = 'automatic',
  } = params;

  const { data: restaurantRow, error: restaurantErr } = await admin
    .from('restaurants')
    .select('feature_flags')
    .eq('id', restaurantId)
    .maybeSingle();
  if (restaurantErr) {
    return {
      ok: false,
      status: 500,
      code: 'restaurant_load_failed',
      message: restaurantErr.message,
    };
  }
  if (
    printSource === 'automatic' &&
    AUTOMATIC_BILL_RECEIPT_VARIANTS.has(variant) &&
    !isRestaurantFeatureEnabled(restaurantRow?.feature_flags, 'bill_receipt_print')
  ) {
    return { ok: true, skipped: true };
  }

  const locale = (printLocale || 'pt') as 'zh' | 'en' | 'pt';
  const jobType: PrintJobType = variant === 'pre_bill' ? 'pre_bill' : 'order_receipt';

  const idempotencyKey =
    billSplitId != null
      ? checkoutReceiptIdempotencyKey(variant, billSplitId, personIndex, collectedPaymentId)
      : undefined;
  if (idempotencyKey) {
    const existingId = await findCheckoutReceiptJobId(admin, restaurantId, idempotencyKey);
    if (existingId) {
      return { ok: true, job_id: existingId, deduped: true };
    }
  }

  let billSplit: BillSplit | null = null;
  if (billSplitId) {
    const { data: split, error: splitErr } = await admin
      .from('bill_splits')
      .select('*')
      .eq('id', billSplitId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (splitErr || !split) {
      return { ok: false, status: 404, code: 'bill_split_not_found' };
    }
    billSplit = split as BillSplit;
  }

  const orderIds =
    orderIdsParam?.length ? orderIdsParam : billSplit?.order_ids?.length ? billSplit.order_ids : undefined;

  const { orders, error: oErr } = await loadOrdersForReceiptPrint(
    admin,
    restaurantId,
    sessionId,
    orderIds,
  );

  if (oErr) {
    return { ok: false, status: 500, code: 'orders_load_failed', message: oErr };
  }
  if (!orders?.length) {
    return { ok: false, status: 404, code: 'no_orders' };
  }

  const orderRows = orders as Order[];

  let lines = buildReceiptLinesFromOrders(orderRows);
  let amountDue = lines.reduce((sum, ln) => sum + ln.unit_price * ln.qty, 0);

  if (variant === 'split_payment') {
    if (billSplitId == null || personIndex == null || personIndex < 0) {
      return { ok: false, status: 400, code: 'missing_split_target' };
    }
    if (!billSplit) {
      return { ok: false, status: 404, code: 'bill_split_not_found' };
    }
    lines = buildSplitPersonReceiptLines(billSplit, personIndex, orderRows);
    const rowAmount = Number(billSplit.result?.[personIndex]?.amount ?? personAmount ?? 0);
    amountDue = rowAmount;
  }

  if (variant === 'checkout_bill' && billSplit) {
    amountDue = checkoutPayableAmount(billSplit, discountRate);
  }

  if (lines.length === 0 && variant === 'pre_bill') {
    return { ok: false, status: 404, code: 'no_billable_items' };
  }

  const printerId = receiptPrinterId?.trim();

  const guestCount = guestCountFromTableOrders(orderRows);
  const firstOrder = orderRows[0]!;
  const allItems = orderRows.flatMap((o) => o.items || []);
  const orderTimeIso = stationTicketOrderTimeIso(allItems, 'legacy', firstOrder.created_at);
  const orderTime = formatStationTicketOrderTime(orderTimeIso);
  const printTime = formatStationTicketOrderTime(new Date().toISOString());

  const subtotal = variant === 'split_payment' ? amountDue : lines.reduce((s, ln) => s + ln.unit_price * ln.qty, 0);
  const due = variant === 'final' && amountPaid != null ? subtotal : amountDue;

  const splitPayerPrinted =
    variant === 'split_payment'
      ? receiptPayerNameForPrint(
          payerName,
          personIndex != null && personIndex >= 0 ? personIndex : 0,
          printLocale,
        )
      : undefined;

  const payload: OrderReceiptJobPayload = {
    order_id: firstOrder.id,
    locale,
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    ...(printerId ? { receipt_printer_id: printerId } : {}),
    receipt_variant: variant,
    table_id: tableId,
    display_name: tableDisplayName,
    ...(guestCount > 0 && variant !== 'split_payment' ? { guest_count: guestCount } : {}),
    ...(splitPayerPrinted ? { payer_name: splitPayerPrinted } : {}),
    ...(orderTime ? { order_time: orderTime } : {}),
    print_time: printTime,
    subtotal,
    amount_due: due,
    lines,
    ordered_by: 'Customer/Merchant',
    ...(variant !== 'pre_bill' &&
    variant !== 'checkout_bill' &&
    amountPaid != null &&
    amountPaid > 0
      ? { amount_paid: amountPaid, payment_method: paymentMethod?.trim() || 'Cash' }
      : {}),
  };

  const { data: inserted, error: insErr } = await admin
    .from('print_jobs')
    .insert({
      restaurant_id: restaurantId,
      type: jobType,
      status: 'pending',
      payload,
    })
    .select('id')
    .single();

  if (insErr || !inserted) {
    return { ok: false, status: 500, code: 'insert_failed', message: insErr?.message };
  }

  return { ok: true, job_id: inserted.id as string };
}
