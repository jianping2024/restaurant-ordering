import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from '@/types';
import { aggregateBuffetHeadcountForOrders } from '@/lib/buffet-order';
import { normalizePrintLocale } from '@/lib/i18n';
import { hanBitmapFontPxFromConfig } from '@/lib/print-agent-config';
import { isRestaurantFeatureEnabled } from '@/lib/restaurant-features';
import { resolveReceiptPrinterId } from '@/lib/restaurant-receipt-printers-server';
import { formatStationTicketOrderTime } from '@/lib/table-guest-count';
import { loadOrdersForReceiptPrint } from '@/lib/order-receipt-enqueue';

/** Sole print job kind for cold-open table slip (payload receipt_variant). */
export const OPEN_TABLE_RECEIPT_VARIANT = 'open_table' as const;

/** Sole idempotency key for one open-table slip per session. */
export function openTableReceiptIdempotencyKey(sessionId: string): string {
  return `session_open:${sessionId}`;
}

export type EnqueueOpenTableReceiptResult =
  | { ok: true; job_id: string; deduped?: boolean }
  | { ok: true; skipped: true }
  | { ok: false; status: number; code: string; message?: string };

async function findOpenTableReceiptJobId(
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

/**
 * Sole enqueue for cold-open table slip — gated by open_table_receipt_print.
 * Headcount notice only (adult/child); no portion qty, no amount due.
 * Paper is rendered by Farvoo Fiscal Agent (`farvoo-fatura`), not this repo.
 */
export async function enqueueOpenTableReceiptPrint(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
  tableId: string;
  tableDisplayName: string;
}): Promise<EnqueueOpenTableReceiptResult> {
  const { admin, restaurantId, sessionId, tableId, tableDisplayName } = params;

  const { data: restaurantRow, error: restaurantErr } = await admin
    .from('restaurants')
    .select('feature_flags, print_agent_config, print_locale')
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
  if (!isRestaurantFeatureEnabled(restaurantRow?.feature_flags, 'open_table_receipt_print')) {
    return { ok: true, skipped: true };
  }

  const idempotencyKey = openTableReceiptIdempotencyKey(sessionId);
  const existingId = await findOpenTableReceiptJobId(admin, restaurantId, idempotencyKey);
  if (existingId) {
    return { ok: true, job_id: existingId, deduped: true };
  }

  const { orders, error: oErr } = await loadOrdersForReceiptPrint(
    admin,
    restaurantId,
    sessionId,
  );
  if (oErr) {
    return { ok: false, status: 500, code: 'orders_load_failed', message: oErr };
  }
  if (!orders?.length) {
    return { ok: false, status: 404, code: 'no_orders' };
  }

  const orderRows = orders as Order[];
  const headcount = aggregateBuffetHeadcountForOrders(orderRows) ?? {
    adults: 0,
    children: 0,
  };
  const locale = normalizePrintLocale(restaurantRow?.print_locale ?? null);
  const hanBitmapFontPx = hanBitmapFontPxFromConfig(restaurantRow?.print_agent_config);
  const printerId = await resolveReceiptPrinterId(admin, restaurantId, undefined, locale);
  const firstOrder = orderRows[0]!;
  const printTime = formatStationTicketOrderTime(new Date().toISOString());
  const orderTime = formatStationTicketOrderTime(firstOrder.created_at);

  const payload = {
    order_id: firstOrder.id,
    locale,
    han_bitmap_font_px: hanBitmapFontPx,
    idempotency_key: idempotencyKey,
    ...(printerId ? { receipt_printer_id: printerId } : {}),
    receipt_variant: OPEN_TABLE_RECEIPT_VARIANT,
    table_id: tableId,
    display_name: tableDisplayName,
    adult_count: headcount.adults,
    child_count: headcount.children,
    ...(orderTime ? { order_time: orderTime } : {}),
    print_time: printTime,
    lines: [] as Array<never>,
    ordered_by: 'Customer/Merchant',
  };

  const { data: inserted, error: insErr } = await admin
    .from('print_jobs')
    .insert({
      restaurant_id: restaurantId,
      type: 'order_receipt',
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

/** Same pattern as call-bill pre_bill: never block open-table on print. */
export function scheduleOpenTableReceiptPrint(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
  tableId: string;
  tableDisplayName: string;
}): void {
  void enqueueOpenTableReceiptPrint(params).catch(() => {});
}
