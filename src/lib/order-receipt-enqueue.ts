import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillSplit, Order, OrderItem, PrintJobType } from '@/types';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import {
  formatStationTicketOrderTime,
  guestCountFromTableOrders,
  stationTicketOrderTimeIso,
} from '@/lib/table-guest-count';

export type ReceiptVariant = 'pre_bill' | 'split_payment' | 'final';

export type OrderReceiptJobPayload = {
  order_id: string;
  locale: 'zh' | 'en' | 'pt';
  receipt_variant: ReceiptVariant;
  restaurant_name?: string;
  table_number: number;
  guest_count?: number;
  payer_name?: string;
  order_time?: string;
  print_time?: string;
  subtotal: number;
  amount_due: number;
  amount_paid?: number;
  payment_method?: string;
  ordered_by?: string;
  lines: Array<{
    item_index: number;
    display_name: string;
    qty: number;
    unit_price: number;
    note?: string;
  }>;
};

function receiptLineName(item: OrderItem): string {
  return (item.name_pt || item.name || item.name_en || item.name_zh || '').trim();
}

export function buildReceiptLinesFromOrders(orders: Order[]): OrderReceiptJobPayload['lines'] {
  const lines: OrderReceiptJobPayload['lines'] = [];
  let itemIndex = 0;
  for (const order of orders) {
    for (const item of order.items || []) {
      const st = normalizeOrderItemStatus(item, order.status);
      if (st === 'voided') continue;
      itemIndex += 1;
      lines.push({
        item_index: itemIndex,
        display_name: receiptLineName(item),
        qty: item.qty,
        unit_price: item.price,
        ...(item.note?.trim() ? { note: item.note.trim() } : {}),
      });
    }
  }
  return lines;
}

/** Lines for one split row (by-item); empty for even/custom → amount-only slip. */
export function buildSplitPersonReceiptLines(
  split: BillSplit,
  personIndex: number,
  orders: Order[],
): OrderReceiptJobPayload['lines'] {
  const row = split.result?.[personIndex];
  if (row?.items?.length) {
    return row.items.map((it, idx) => ({
      item_index: idx + 1,
      display_name: it.name,
      qty: it.qty,
      unit_price: it.qty > 0 ? it.price / it.qty : it.price,
    }));
  }

  if (split.split_mode !== 'by_item') return [];

  const person = split.persons?.[personIndex];
  const keys = new Set(person?.items || []);
  if (keys.size === 0) return [];

  const lines: OrderReceiptJobPayload['lines'] = [];
  let itemIndex = 0;
  for (const order of orders) {
    (order.items || []).forEach((item, idx) => {
      const st = normalizeOrderItemStatus(item, order.status);
      if (st === 'voided') return;
      const key = `${order.id}-${idx}`;
      if (!keys.has(key) && !keys.has(item.id)) return;
      itemIndex += 1;
      lines.push({
        item_index: itemIndex,
        display_name: receiptLineName(item),
        qty: item.qty,
        unit_price: item.price,
      });
    });
  }
  return lines;
}

type EnqueueParams = {
  admin: SupabaseClient;
  restaurantId: string;
  restaurantName?: string | null;
  printLocale: string | null;
  sessionId: string;
  tableNumber: number;
  variant: ReceiptVariant;
  payerName?: string;
  personAmount?: number;
  billSplitId?: string;
  personIndex?: number;
  amountPaid?: number;
  paymentMethod?: string;
};

export async function enqueueReceiptPrint(
  params: EnqueueParams,
): Promise<
  | { ok: true; job_id: string }
  | { ok: false; status: number; code: string; message?: string }
> {
  const {
    admin,
    restaurantId,
    restaurantName,
    printLocale,
    sessionId,
    tableNumber,
    variant,
    payerName,
    personAmount,
    billSplitId,
    personIndex,
    amountPaid,
    paymentMethod,
  } = params;

  const locale = (printLocale || 'pt') as 'zh' | 'en' | 'pt';
  const jobType: PrintJobType = variant === 'pre_bill' ? 'pre_bill' : 'order_receipt';

  const { data: orders, error: oErr } = await admin
    .from('orders')
    .select('id, status, items, created_at, updated_at')
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId)
    .eq('table_number', tableNumber)
    .order('created_at', { ascending: true });

  if (oErr) {
    return { ok: false, status: 500, code: 'orders_load_failed', message: oErr.message };
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
    const { data: split, error: splitErr } = await admin
      .from('bill_splits')
      .select('*')
      .eq('id', billSplitId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (splitErr || !split) {
      return { ok: false, status: 404, code: 'bill_split_not_found' };
    }
    lines = buildSplitPersonReceiptLines(split as BillSplit, personIndex, orderRows);
    const rowAmount = Number((split as BillSplit).result?.[personIndex]?.amount ?? personAmount ?? 0);
    amountDue = rowAmount;
  }

  if (lines.length === 0 && variant === 'pre_bill') {
    return { ok: false, status: 404, code: 'no_billable_items' };
  }

  const guestCount = guestCountFromTableOrders(orderRows);
  const firstOrder = orderRows[0]!;
  const allItems = orderRows.flatMap((o) => o.items || []);
  const orderTimeIso = stationTicketOrderTimeIso(allItems, 'legacy', firstOrder.created_at);
  const orderTime = formatStationTicketOrderTime(orderTimeIso);
  const printTime = formatStationTicketOrderTime(new Date().toISOString());

  const subtotal = variant === 'split_payment' ? amountDue : lines.reduce((s, ln) => s + ln.unit_price * ln.qty, 0);
  const due = variant === 'final' && amountPaid != null ? subtotal : amountDue;

  const payload: OrderReceiptJobPayload = {
    order_id: firstOrder.id,
    locale,
    receipt_variant: variant,
    ...(restaurantName?.trim() ? { restaurant_name: restaurantName.trim() } : {}),
    table_number: tableNumber,
    ...(guestCount > 0 && variant !== 'split_payment' ? { guest_count: guestCount } : {}),
    ...(variant === 'split_payment' && payerName?.trim() ? { payer_name: payerName.trim() } : {}),
    ...(orderTime ? { order_time: orderTime } : {}),
    print_time: printTime,
    subtotal,
    amount_due: due,
    lines,
    ordered_by: 'Customer/Merchant',
    ...(variant !== 'pre_bill' && amountPaid != null && amountPaid > 0
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

/** @deprecated Use enqueueReceiptPrint */
export async function enqueueOrderReceiptForSession(
  params: Omit<EnqueueParams, 'variant'> & {
    jobType?: Extract<PrintJobType, 'order_receipt' | 'pre_bill'>;
  },
) {
  const variant: ReceiptVariant =
    params.jobType === 'pre_bill' ? 'pre_bill' : 'final';
  return enqueueReceiptPrint({ ...params, variant });
}
