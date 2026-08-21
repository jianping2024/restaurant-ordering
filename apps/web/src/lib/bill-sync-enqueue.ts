import { createHash, randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildBillSyncLine,
  type BillSyncPayload,
  validateBillSyncPayload,
} from '@/lib/bill-sync-payload';
import {
  billableLineAmount,
  buildBillableSessionItems,
} from '@/lib/billable-session-lines';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import { isBuffetBaseItem } from '@/lib/order-items';
import type { Order, OrderItem } from '@/types';

export type EnqueueBillSyncInput = {
  admin: SupabaseClient;
  restaurantId: string;
  billSplitId: string;
  tableDisplayName: string;
  orders: Order[];
  itemCodeByMenuId: Record<string, string>;
  vatRateByMenuId: Record<string, number>;
  /** Default VAT when menu id missing (buffet synthetic). */
  defaultVatRatePercent: number;
  createdBy: string | null;
  requestId?: string;
};

export type EnqueueBillSyncResult =
  | { ok: true; job: { id: string; status: string; request_id: string } }
  | { ok: false; error: string; status: number; message?: string };

/**
 * Sole fiscal item_code for a billable line (menu snapshot or buffet_base).
 * Buffet has no catalog item_code — stable `BF` + first 8 hex of buffet uuid.
 */
export function resolveBillSyncItemCode(
  item: OrderItem,
  itemCodeByMenuId: Record<string, string>,
): string {
  const fromMenu = (resolveMenuItemCode(item, itemCodeByMenuId) ?? '').trim();
  if (fromMenu) return fromMenu;
  if (!isBuffetBaseItem(item)) return '';
  const buffetId = (item.buffet_id || item.id.replace(/^buffet:/, '')).replace(/-/g, '');
  if (buffetId.length < 8) return '';
  return `BF${buffetId.slice(0, 8).toUpperCase()}`;
}

/**
 * Sole server enqueue for fiscal bill-sync jobs.
 * Builds whole_table snapshot from current billable orders (draft for Agent).
 */
export async function enqueueBillSyncJob(
  input: EnqueueBillSyncInput,
): Promise<EnqueueBillSyncResult> {
  const requestId = input.requestId?.trim() || randomUUID();
  const rows = buildBillableSessionItems(input.orders);
  const lines = [];
  for (const row of rows) {
    const { item } = row;
    const itemCode = resolveBillSyncItemCode(item, input.itemCodeByMenuId);
    if (!itemCode) {
      return { ok: false, error: 'empty_item_code', status: 400 };
    }
    const name = resolveMenuItemLocalizedName(item, 'pt');
    const lineGross = billableLineAmount(row);
    const qty =
      typeof row.chargeableQty === 'number' && row.chargeableQty > 0
        ? row.chargeableQty
        : item.qty;
    const unit =
      typeof row.chargeableUnitPrice === 'number'
        ? row.chargeableUnitPrice
        : qty > 0
          ? lineGross / qty
          : item.price;
    const vatPercent =
      (item.id && !isBuffetBaseItem(item) ? input.vatRateByMenuId[item.id] : undefined) ??
      input.defaultVatRatePercent;
    const built = buildBillSyncLine({
      item_code: itemCode,
      name,
      qty,
      unit_price_gross: unit,
      line_gross: lineGross,
      vat_rate_percent: vatPercent,
    });
    if ('error' in built) {
      return { ok: false, error: built.error, status: 400 };
    }
    lines.push(built);
  }

  if (lines.length === 0) {
    return { ok: false, error: 'empty_lines', status: 400 };
  }

  const gross = lines.reduce((sum, line) => sum + Number(line.line_gross), 0);
  const payload: BillSyncPayload = {
    request_id: requestId,
    source_system: 'farvoo',
    source_sale_id: input.billSplitId,
    table_display_name: input.tableDisplayName.trim() || '—',
    scope_type: 'whole_table',
    lines,
    gross_total: (Math.round(gross * 100) / 100).toFixed(2),
  };

  const invalid = validateBillSyncPayload(payload);
  if (invalid) {
    return { ok: false, error: invalid, status: 400 };
  }

  const { data: existing } = await input.admin
    .from('bill_sync_jobs')
    .select('id, status, request_id')
    .eq('restaurant_id', input.restaurantId)
    .eq('request_id', requestId)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      job: {
        id: existing.id as string,
        status: existing.status as string,
        request_id: existing.request_id as string,
      },
    };
  }

  const { data: inserted, error } = await input.admin
    .from('bill_sync_jobs')
    .insert({
      restaurant_id: input.restaurantId,
      request_id: requestId,
      source_system: 'farvoo',
      source_sale_id: input.billSplitId,
      table_display_name: payload.table_display_name,
      scope_type: 'whole_table',
      payload,
      status: 'pending',
      created_by: input.createdBy,
    })
    .select('id, status, request_id')
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      error: 'insert_failed',
      status: 500,
      message: error?.message,
    };
  }

  return {
    ok: true,
    job: {
      id: inserted.id as string,
      status: inserted.status as string,
      request_id: inserted.request_id as string,
    },
  };
}

/** Stable client idempotency helper when UI retries the same click. */
export function mintBillSyncRequestId(): string {
  return randomUUID();
}

export function billSyncPayloadFingerprint(payload: BillSyncPayload): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}
