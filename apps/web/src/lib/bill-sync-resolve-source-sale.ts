/**
 * Sole resolver for bill-sync source_sale_id: reuse active bill_split or ensure whole_table.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { submitCheckoutRequestForTable } from '@/lib/checkout-request-server';
import { buildWholeTableCheckoutPayload } from '@/lib/checkout-split-intent';
import { deriveBillView } from '@/lib/customer-bill-sync';
import { loadCustomerSessionOrders } from '@/lib/customer-session-context';

export type ResolveBillSyncSourceSaleResult =
  | { ok: true; billSplitId: string; tableId: string; ensured: boolean }
  | { ok: false; error: string; status: number; message?: string };

const ACTIVE_SPLIT_STATUSES = ['pending', 'confirmed', 'requested'] as const;

/**
 * Resolve `bill_splits.id` for fiscal sync.
 * - `billSplitId`: verify tenant + return its table.
 * - `tableId`: reuse active session split; only when none, ensure whole_table (no auto pre_bill).
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

  const sessionId = session.id as string;
  const { data: existing, error: existingErr } = await input.admin
    .from('bill_splits')
    .select('id')
    .eq('restaurant_id', input.restaurantId)
    .eq('session_id', sessionId)
    .in('status', [...ACTIVE_SPLIT_STATUSES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingErr) {
    return { ok: false, error: 'lookup_failed', status: 500, message: existingErr.message };
  }
  if (existing?.id) {
    return {
      ok: true,
      billSplitId: existing.id as string,
      tableId,
      ensured: false,
    };
  }

  const orders = await loadCustomerSessionOrders({
    admin: input.admin,
    restaurantId: input.restaurantId,
    sessionId,
    ascending: true,
  });
  const { total } = deriveBillView(orders);
  const ensured = await submitCheckoutRequestForTable(
    input.admin,
    input.restaurantId,
    tableId,
    buildWholeTableCheckoutPayload(total),
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
