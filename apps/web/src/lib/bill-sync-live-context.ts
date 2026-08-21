/**
 * Shared Restaurant load for bill-sync POST enqueue + GET content_unchanged.
 * Sole place that gathers split + session orders + catalog codes/VAT for a bill_split.
 */
import { buildBillSyncJobPayload } from '@/lib/bill-sync-build-payload';
import { billSyncContentFingerprint } from '@/lib/bill-sync-content-fingerprint';
import { parseSplitMode } from '@/lib/checkout-split-intent';
import { distinctMenuItemIdsFromOrders } from '@/lib/menu-item-code';
import { DEFAULT_MENU_VAT_RATE } from '@/lib/menu-vat-rate';
import { loadTableOrdersForSession } from '@/lib/waiter-table-detail-load';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order, SplitPerson } from '@/types';
import { randomUUID } from 'crypto';

export type BillSyncLiveContext = {
  billSplitId: string;
  tableDisplayName: string;
  splitMode: string | null;
  persons: SplitPerson[];
  orders: Order[];
  itemCodeByMenuId: Record<string, string>;
  vatRateByMenuId: Record<string, number>;
  defaultVatRatePercent: number;
};

export type LoadBillSyncLiveContextResult =
  | { ok: true; ctx: BillSyncLiveContext }
  | { ok: false; error: string; status: number; message?: string };

export async function loadBillSyncLiveContext(input: {
  admin: SupabaseClient;
  restaurantId: string;
  billSplitId: string;
}): Promise<LoadBillSyncLiveContextResult> {
  const { data: split, error: splitErr } = await input.admin
    .from('bill_splits')
    .select('id, restaurant_id, table_id, session_id, status, total_amount, split_mode, persons')
    .eq('id', input.billSplitId)
    .eq('restaurant_id', input.restaurantId)
    .maybeSingle();

  if (splitErr || !split) {
    return { ok: false, error: 'bill_split_not_found', status: 404 };
  }

  const sessionId = typeof split.session_id === 'string' ? split.session_id : '';
  if (!sessionId) {
    return { ok: false, error: 'missing_session', status: 409 };
  }

  const { data: tableRow } = await input.admin
    .from('restaurant_tables')
    .select('display_name')
    .eq('id', split.table_id)
    .maybeSingle();

  let orders: Order[];
  try {
    orders = await loadTableOrdersForSession(
      input.admin,
      input.restaurantId,
      sessionId,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'orders_lookup_failed';
    return { ok: false, error: 'orders_lookup_failed', status: 500, message };
  }

  const menuIds = distinctMenuItemIdsFromOrders(orders);
  const itemCodeByMenuId: Record<string, string> = {};
  const vatRateByMenuId: Record<string, number> = {};
  if (menuIds.length > 0) {
    const { data: menuRows } = await input.admin
      .from('menu_items')
      .select('id, item_code, vat_rate')
      .eq('restaurant_id', input.restaurantId)
      .in('id', menuIds);
    for (const row of menuRows ?? []) {
      const id = String(row.id);
      if (typeof row.item_code === 'string' && row.item_code.trim()) {
        itemCodeByMenuId[id] = row.item_code.trim();
      }
      if (typeof row.vat_rate === 'number' && Number.isFinite(row.vat_rate)) {
        vatRateByMenuId[id] = row.vat_rate;
      }
    }
  }

  return {
    ok: true,
    ctx: {
      billSplitId: input.billSplitId,
      tableDisplayName:
        typeof tableRow?.display_name === 'string' ? tableRow.display_name : '—',
      splitMode: typeof split.split_mode === 'string' ? split.split_mode : null,
      persons: Array.isArray(split.persons) ? (split.persons as SplitPerson[]) : [],
      orders,
      itemCodeByMenuId,
      vatRateByMenuId,
      defaultVatRatePercent: DEFAULT_MENU_VAT_RATE,
    },
  };
}

/** Live content fingerprint for the current bill (same builder as enqueue). */
export function liveBillSyncContentFingerprint(ctx: BillSyncLiveContext): string | null {
  const splitMode = parseSplitMode(ctx.splitMode) ?? 'whole_table';
  const built = buildBillSyncJobPayload({
    requestId: randomUUID(),
    billSplitId: ctx.billSplitId,
    tableDisplayName: ctx.tableDisplayName,
    splitMode,
    persons: ctx.persons,
    orders: ctx.orders,
    itemCodeByMenuId: ctx.itemCodeByMenuId,
    vatRateByMenuId: ctx.vatRateByMenuId,
    defaultVatRatePercent: ctx.defaultVatRatePercent,
  });
  if (!built.ok) return null;
  return billSyncContentFingerprint(built.payload);
}
