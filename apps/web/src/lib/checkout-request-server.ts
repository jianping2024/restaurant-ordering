import type { SupabaseClient } from '@supabase/supabase-js';
import { buildByItemAllocationsFromPersons } from '@/lib/bill-split-by-item';
import { loadCustomerSessionOrders } from '@/lib/customer-session-context';
import { validateBillSplit } from '@/lib/bill-split-validate';
import { sumLineTotals } from '@/lib/cart-totals';
import type { CheckoutRequestPayload } from '@/lib/checkout-request-payload';
import type { SplitResult } from '@/types';

export type { CheckoutRequestPayload } from '@/lib/checkout-request-payload';

export type CheckoutRequestResult =
  | { ok: true; bill_split_id: string; result: SplitResult[]; total_amount: number }
  | { ok: false; error: string; status: number; message?: string };

export async function submitCheckoutRequestForTable(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
  payload: CheckoutRequestPayload,
): Promise<CheckoutRequestResult> {
  const { data: tableRow, error: tableErr } = await admin
    .from('restaurant_tables')
    .select('id, display_name')
    .eq('restaurant_id', restaurantId)
    .eq('id', tableId)
    .is('deleted_at', null)
    .maybeSingle();
  if (tableErr || !tableRow) {
    return { ok: false, error: 'table_not_available', status: 400 };
  }

  const { data: session, error: sessionErr } = await admin
    .from('table_sessions')
    .select('id, status')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sessionErr) {
    return {
      ok: false,
      error: 'session_lookup_failed',
      status: 500,
      message: sessionErr.message,
    };
  }
  if (!session?.id) {
    return { ok: false, error: 'no_active_session', status: 404 };
  }
  if (session.status === 'billing') {
    return { ok: false, error: 'session_billing', status: 409 };
  }

  const sessionId = session.id as string;
  const orders = await loadCustomerSessionOrders({
    admin,
    restaurantId,
    sessionId,
    ascending: true,
  });
  const allItems = orders.flatMap((order) =>
    order.items.map((item, idx) => ({
      ...item,
      key: `${order.id}-${idx}`,
    })),
  );
  if (allItems.length === 0) {
    return { ok: false, error: 'empty_session', status: 400 };
  }

  const itemLines = allItems.map((item) => ({ key: item.key, qty: item.qty }));
  const lineQtyByKey = Object.fromEntries(itemLines.map((line) => [line.key, line.qty]));
  const total = sumLineTotals(allItems);
  const validation = validateBillSplit({
    splitMode: payload.splitMode,
    total,
    results: payload.result,
    itemLines: payload.splitMode === 'by_item' ? itemLines : undefined,
    byItemAllocations:
      payload.splitMode === 'by_item'
        ? buildByItemAllocationsFromPersons(payload.persons, lineQtyByKey)
        : undefined,
  });
  if (!validation.ok) {
    return { ok: false, error: validation.issue, status: 400 };
  }

  const orderIds = orders.map((order) => order.id);
  const { data: rpcData, error: rpcErr } = await admin.rpc('upsert_bill_split_request', {
    p_restaurant_id: restaurantId,
    p_session_id: sessionId,
    p_table_id: tableId,
    p_display_name: tableRow.display_name as string,
    p_order_ids: orderIds,
    p_split_mode: payload.splitMode,
    p_persons: payload.persons,
    p_result: payload.result,
    p_total_amount: total,
    p_customer_nif: payload.customerNif ?? null,
  });

  if (rpcErr) {
    return { ok: false, error: 'upsert_failed', status: 500, message: rpcErr.message };
  }

  const rpcPayload = rpcData as {
    ok?: boolean;
    code?: string;
    message?: string;
    bill_split_id?: string;
    result?: SplitResult[];
    total_amount?: number;
  } | null;

  if (!rpcPayload?.ok) {
    const code = rpcPayload?.code ?? 'upsert_failed';
    const status =
      code === 'no_active_session' ? 404 : code === 'invalid_request' ? 400 : 500;
    return { ok: false, error: code, status, message: rpcPayload?.message };
  }

  return {
    ok: true,
    bill_split_id: rpcPayload.bill_split_id as string,
    result: (rpcPayload.result || payload.result) as SplitResult[],
    total_amount: rpcPayload.total_amount ?? total,
  };
}
