import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillSplit, Order, OrderItem, PrintJobType } from '@/types';
import {
  formatBuffetReceiptQtyLabel,
} from '@/lib/buffet-order';
import { buffetIdFromOrderItem } from '@/lib/bill-sync-build-payload';
import {
  formatBillSyncVatRate,
  type BillSyncPaymentLine,
} from '@/lib/bill-sync-payload';
import { buildByItemSplitOrderLines } from '@/lib/bill-split-by-item-lines';
import { billableLineAmount, buildPaperBillableSessionItems } from '@/lib/billable-session-lines';
import { isBuffetBaseItem } from '@/lib/order-items';
import { isRestaurantFeatureEnabled } from '@/lib/restaurant-features';
import { buildSplitPersonShareLines } from '@/lib/checkout-split-person-lines';
import { normalizePrintLocale, type PrintLocale } from '@/lib/i18n';
import { distinctMenuItemIdsFromOrders } from '@/lib/menu-item-code';
import { orderItemReceiptLineLabel } from '@/lib/menu-print-label';
import { checkoutPayableAmount } from '@/lib/checkout-split-math';
import { receiptPayerNameForPrint } from '@/lib/receipt-payer-label';
import { hanBitmapFontPxFromConfig } from '@/lib/print-agent-config';
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
  /** Sole multi-tender rows (never one-line MIXED on ticket). */
  payment_lines?: BillSyncPaymentLine[];
  ordered_by?: string;
  /** Checkout confirm dedup; ignored by print agent */
  idempotency_key?: string;
  /** Chinese bitmap TrueType size (px); agent default 24 when omitted. */
  han_bitmap_font_px: number;
  lines: Array<{
    item_index: number;
    display_name: string;
    qty: number;
    unit_price: number;
    note?: string;
    /** Snapshot IVA percent string e.g. "13.00" (fail-closed when missing at enqueue). */
    vat_rate?: string;
    /** by_item split receipts: person's share of dish qty (e.g. 1/3) for thermal Qty column */
    share_qty_label?: string;
  }>;
};

function buffetReceiptShareQtyLabel(item: OrderItem): string | undefined {
  if (!isBuffetBaseItem(item)) return undefined;
  const label = formatBuffetReceiptQtyLabel(item.adult_count ?? 0, item.child_count ?? 0);
  return label || undefined;
}

function receiptLineFromOrderItem(
  item: OrderItem,
  itemIndex: number,
  locale: PrintLocale,
  vatRate?: string,
): OrderReceiptJobPayload['lines'][number] {
  const share_qty_label = buffetReceiptShareQtyLabel(item);
  return {
    item_index: itemIndex,
    display_name: orderItemReceiptLineLabel(item, locale),
    qty: item.qty,
    unit_price: item.price,
    ...(vatRate ? { vat_rate: vatRate } : {}),
    ...(share_qty_label ? { share_qty_label } : {}),
  };
}

function vatRateStringForItem(
  item: OrderItem,
  vatRateByMenuId: Record<string, number>,
  vatRateByBuffetId: Record<string, number>,
): string | null {
  try {
    if (isBuffetBaseItem(item)) {
      const buffetId = buffetIdFromOrderItem(item);
      if (!buffetId) return null;
      const rate = vatRateByBuffetId[buffetId];
      if (typeof rate !== 'number' || !Number.isFinite(rate)) return null;
      return formatBillSyncVatRate(rate);
    }
    if (item.id && typeof vatRateByMenuId[item.id] === 'number') {
      return formatBillSyncVatRate(vatRateByMenuId[item.id]!);
    }
  } catch {
    return null;
  }
  return null;
}

async function loadReceiptVatMaps(
  admin: SupabaseClient,
  restaurantId: string,
  orders: Order[],
): Promise<{
  vatRateByMenuId: Record<string, number>;
  vatRateByBuffetId: Record<string, number>;
}> {
  const vatRateByMenuId: Record<string, number> = {};
  const vatRateByBuffetId: Record<string, number> = {};
  const menuIds = distinctMenuItemIdsFromOrders(orders);
  if (menuIds.length > 0) {
    const { data: menuRows } = await admin
      .from('menu_items')
      .select('id, vat_rate')
      .eq('restaurant_id', restaurantId)
      .in('id', menuIds);
    for (const row of menuRows ?? []) {
      if (typeof row.vat_rate === 'number' && Number.isFinite(row.vat_rate)) {
        vatRateByMenuId[String(row.id)] = row.vat_rate;
      }
    }
  }
  const buffetIds = new Set<string>();
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const id = buffetIdFromOrderItem(item);
      if (id) buffetIds.add(id);
    }
  }
  if (buffetIds.size > 0) {
    const { data: buffetRows } = await admin
      .from('buffets')
      .select('id, vat_rate')
      .eq('restaurant_id', restaurantId)
      .in('id', Array.from(buffetIds));
    for (const row of buffetRows ?? []) {
      if (typeof row.vat_rate === 'number' && Number.isFinite(row.vat_rate)) {
        vatRateByBuffetId[String(row.id)] = row.vat_rate;
      }
    }
  }
  return { vatRateByMenuId, vatRateByBuffetId };
}

/** Merge key for billable menu lines (notes ignored). */
export { billableMenuItemMergeKey as receiptMenuItemMergeKey } from '@/lib/billable-session-lines';

export function buildReceiptLinesFromOrders(
  orders: Order[],
  locale: PrintLocale = 'pt',
  vatRateByMenuId: Record<string, number> = {},
  vatRateByBuffetId: Record<string, number> = {},
): OrderReceiptJobPayload['lines'] | { error: string } {
  const lines: OrderReceiptJobPayload['lines'] = [];
  let itemIndex = 0;

  for (const row of buildPaperBillableSessionItems(orders)) {
    itemIndex += 1;
    const amount = billableLineAmount(row);
    const qty = Math.max(0, Number(row.item.qty) || 0);
    // One receipt row per dish (no free/overage split); unit carries the billable average.
    const unitPrice = qty > 0 ? amount / qty : 0;
    const item =
      unitPrice === row.item.price ? row.item : { ...row.item, price: unitPrice };
    const vat_rate = vatRateStringForItem(item, vatRateByMenuId, vatRateByBuffetId);
    if (!vat_rate) return { error: 'missing_vat_rate' };
    lines.push(receiptLineFromOrderItem(item, itemIndex, locale, vat_rate));
  }

  return lines;
}

/** Lines for one split row (by-item); empty for even/custom → amount-only slip. */
export function buildSplitPersonReceiptLines(
  split: BillSplit,
  personIndex: number,
  orders: Order[],
  locale: PrintLocale = 'pt',
  vatRateByMenuId: Record<string, number> = {},
  vatRateByBuffetId: Record<string, number> = {},
): OrderReceiptJobPayload['lines'] | { error: string } {
  const byKey = new Map(
    buildByItemSplitOrderLines(orders).map((line) => [line.key, line]),
  );
  const shares = buildSplitPersonShareLines(split, personIndex, orders, locale);
  const lines: OrderReceiptJobPayload['lines'] = [];
  for (let index = 0; index < shares.length; index++) {
    const row = shares[index]!;
    if (!(row.shareAmount > 0)) continue;
    const catalog = byKey.get(row.key);
    const vat_rate = catalog
      ? vatRateStringForItem(catalog, vatRateByMenuId, vatRateByBuffetId)
      : null;
    if (!vat_rate) return { error: 'missing_vat_rate' };
    lines.push({
      item_index: lines.length + 1,
      display_name: row.receiptLabel,
      qty: 1,
      unit_price: row.shareAmount,
      vat_rate,
      share_qty_label: row.quantityLabel,
    });
  }
  return lines;
}

/** Stable key for checkout automatic receipt jobs (call-bill / split / final dedup). */
export function checkoutReceiptIdempotencyKey(
  variant: ReceiptVariant,
  billSplitId: string,
  personIndex?: number,
  collectedPaymentId?: string | null,
): string | undefined {
  if (variant === 'pre_bill') {
    return `checkout:${billSplitId}:pre_bill`;
  }
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
  jobType: PrintJobType,
): Promise<string | null> {
  const { data, error } = await admin
    .from('print_jobs')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('type', jobType)
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
  paymentLines?: BillSyncPaymentLine[] | null;
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
    paymentLines,
    receiptPrinterId,
    orderIds: orderIdsParam,
    discountRate = 0,
    collectedPaymentId,
    printSource = 'automatic',
  } = params;

  const { data: restaurantRow, error: restaurantErr } = await admin
    .from('restaurants')
    .select('feature_flags, print_agent_config')
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

  const hanBitmapFontPx = hanBitmapFontPxFromConfig(restaurantRow?.print_agent_config);

  const locale = normalizePrintLocale(printLocale);
  const jobType: PrintJobType = variant === 'pre_bill' ? 'pre_bill' : 'order_receipt';

  const idempotencyKey =
    billSplitId != null
      ? checkoutReceiptIdempotencyKey(variant, billSplitId, personIndex, collectedPaymentId)
      : undefined;
  if (idempotencyKey) {
    const existingId = await findCheckoutReceiptJobId(
      admin,
      restaurantId,
      idempotencyKey,
      jobType,
    );
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
  const { vatRateByMenuId, vatRateByBuffetId } = await loadReceiptVatMaps(
    admin,
    restaurantId,
    orderRows,
  );

  const linesResult = buildReceiptLinesFromOrders(
    orderRows,
    locale,
    vatRateByMenuId,
    vatRateByBuffetId,
  );
  if ('error' in linesResult) {
    return { ok: false, status: 400, code: linesResult.error };
  }
  let lines = linesResult;
  let amountDue = lines.reduce((sum, ln) => sum + ln.unit_price * ln.qty, 0);

  if (variant === 'split_payment') {
    if (billSplitId == null || personIndex == null || personIndex < 0) {
      return { ok: false, status: 400, code: 'missing_split_target' };
    }
    if (!billSplit) {
      return { ok: false, status: 404, code: 'bill_split_not_found' };
    }
    const shareLines = buildSplitPersonReceiptLines(
      billSplit,
      personIndex,
      orderRows,
      locale,
      vatRateByMenuId,
      vatRateByBuffetId,
    );
    if ('error' in shareLines) {
      return { ok: false, status: 400, code: shareLines.error };
    }
    lines = shareLines;
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
    han_bitmap_font_px: hanBitmapFontPx,
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
      ? {
          amount_paid: amountPaid,
          payment_method: paymentMethod?.trim() || 'CASH',
          ...(paymentLines?.length ? { payment_lines: paymentLines } : {}),
        }
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
