/**
 * Sole resolver for bill-sync source_sale_id: reuse active bill_split or ensure whole_table.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadActiveBillSplitForSession } from '@/lib/checkout-active-bill-split';
import { ensureStaffCheckoutEntryForTable } from '@/lib/checkout-request-server';

export type ResolveBillSyncSourceSaleResult =
  | { ok: true; billSplitId: string; tableId: string; ensured: boolean }
  | { ok: false; error: string; status: number; message?: string };

/**
 * Resolve `bill_splits.id` for fiscal sync.
 * - `billSplitId`: verify tenant + return its table.
 * - `tableId`: reuse active session split via loadActiveBillSplitForSession;
 *   only when none, ensureStaffCheckoutEntryForTable (whole_table, no auto pre_bill).
 */
export async function resolveBillSyncSourceSale(input: {
  admin: SupabaseClient;
  restaurantId: string;
  billSplitId?: string;
  tableId?: string;
}): Promise<ResolveBillSyncSourceSaleResult> {
  const billSplitId = input.billSplitId?.trim() ?? '';
  const tableId = input.tableId?.trim() ?? '';

  if (billSplitId && tableId) {
    return { ok: false, error: 'ambiguous_source', status: 400 };
  }
  if (!billSplitId && !tableId) {
    return { ok: false, error: 'missing_source', status: 400 };
  }

  if (billSplitId) {
    const { data: split, error } = await input.admin
      .from('bill_splits')
      .select('id, table_id')
      .eq('id', billSplitId)
      .eq('restaurant_id', input.restaurantId)
      .maybeSingle();
    if (error) {
      return { ok: false, error: 'lookup_failed', status: 500, message: error.message };
    }
    if (!split?.id || typeof split.table_id !== 'string') {
      return { ok: false, error: 'bill_split_not_found', status: 404 };
    }
    return {
      ok: true,
      billSplitId: split.id as string,
      tableId: split.table_id,
      ensured: false,
    };
  }

  const { data: session, error: sessionErr } = await input.admin
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', input.restaurantId)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sessionErr) {
    return { ok: false, error: 'session_lookup_failed', status: 500, message: sessionErr.message };
  }
  if (!session?.id) {
    return { ok: false, error: 'no_active_session', status: 404 };
  }

  const existing = await loadActiveBillSplitForSession({
    admin: input.admin,
    restaurantId: input.restaurantId,
    sessionId: session.id as string,
  });
  if (existing?.id) {
    return {
      ok: true,
      billSplitId: existing.id,
      tableId,
      ensured: false,
    };
  }

  const ensured = await ensureStaffCheckoutEntryForTable(
    input.admin,
    input.restaurantId,
    tableId,
    { skipAutomaticPreBill: true },
  );
  if (!ensured.ok) {
    return {
      ok: false,
      error: ensured.error,
      status: ensured.status,
      message: ensured.message,
    };
  }
  return {
    ok: true,
    billSplitId: ensured.bill_split_id,
    tableId,
    ensured: true,
  };
}
