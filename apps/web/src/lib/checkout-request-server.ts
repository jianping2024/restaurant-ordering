import type { SupabaseClient } from '@supabase/supabase-js';
import {
  checkoutPayloadFromBillSplit,
  loadActiveBillSplitForSession,
} from '@/lib/checkout-active-bill-split';
import { checkoutErrorStatus, checkoutFailure } from '@/lib/checkout-error-codes';
import { validateCheckoutContinuation } from '@/lib/checkout-split-continuation';
import { validateSubmittedCheckoutSplit } from '@/lib/checkout-request-submit';
import { loadCustomerSessionOrders } from '@/lib/customer-session-context';
import {
  parseSessionCollectedPayments,
  SESSION_COLLECTED_PAYMENT_SELECT,
} from '@/lib/checkout-session-payments';
import {
  buildWholeTableCheckoutPayload,
  normalizeCheckoutRequestPayload,
} from '@/lib/checkout-split-intent';
import type { CheckoutRequestPayload } from '@/lib/checkout-split-intent';
import { enqueueReceiptPrint } from '@/lib/order-receipt-enqueue';
import { isBillGuestCountConfirmed } from '@/lib/table-guest-count';
import { isPartyMemberCountAllowedForCheckout } from '@/lib/table-party-groups';
import { countPartyMembersForTable } from '@/lib/table-party-groups-server';
import type { BillSplit, SplitResult } from '@/types';

export type { CheckoutRequestPayload } from '@/lib/checkout-split-intent';

export type CheckoutRequestResult =
  | {
      ok: true;
      bill_split_id: string;
      result: SplitResult[];
      total_amount: number;
      session_id: string;
      table_name: string;
      split_mode: string;
    }
  | { ok: false; error: string; status: number; message?: string };

/** Same pattern as confirm-payment automatic receipts: never block checkout on print. */
function scheduleCallBillPreBillPrint(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
  tableId: string;
  tableDisplayName: string;
  billSplitId: string;
}): void {
  const { admin, restaurantId, sessionId, tableId, tableDisplayName, billSplitId } = params;
  void (async () => {
    const { data: rest } = await admin
      .from('restaurants')
      .select('print_locale')
      .eq('id', restaurantId)
      .maybeSingle();
    await enqueueReceiptPrint({
      admin,
      restaurantId,
      printLocale: (rest?.print_locale as string | null) ?? null,
      sessionId,
      tableId,
      tableDisplayName,
      variant: 'pre_bill',
      printSource: 'automatic',
      billSplitId,
    });
  })().catch(() => {});
}

export async function submitCheckoutRequestForTable(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
  payload: CheckoutRequestPayload,
  options?: {
    /** Fiscal sync-and-close ensure must not enqueue automatic pre_bill. */
    skipAutomaticPreBill?: boolean;
    /** Staff per-person by-item collect. Guest callers must not set this. */
    allowPartialByItem?: boolean;
    /** Staff floor reopen of preserved active plan. Guest must not set this. */
    staffReopenActivePlan?: boolean;
  },
): Promise<CheckoutRequestResult> {
  const normalizedPayload = normalizeCheckoutRequestPayload(payload);

  const { data: tableRow, error: tableErr } = await admin
    .from('restaurant_tables')
    .select('id, display_name')
    .eq('restaurant_id', restaurantId)
    .eq('id', tableId)
    .is('deleted_at', null)
    .maybeSingle();
  if (tableErr || !tableRow) {
    return checkoutFailure('table_not_available');
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
    return checkoutFailure('no_active_session');
  }

  const sessionId = session.id as string;
  const orders = await loadCustomerSessionOrders({
    admin,
    restaurantId,
    sessionId,
    ascending: true,
  });
  const { orderLines, lineSpecs, total, validation } = validateSubmittedCheckoutSplit(
    orders,
    normalizedPayload,
    {
      allowPartialByItem: options?.allowPartialByItem,
      staffReopenActivePlan: options?.staffReopenActivePlan,
    },
  );
  // Sole whole-table amount: billable session total (ignore client amount:0 placeholders).
  const payloadForPersist =
    normalizedPayload.splitMode === 'whole_table'
      ? normalizeCheckoutRequestPayload(normalizedPayload, {
          authoritativeWholeTableTotal: total,
        })
      : normalizedPayload;
  if (orderLines.length === 0) {
    return checkoutFailure('empty_session');
  }
  if (!isBillGuestCountConfirmed(orders)) {
    return checkoutFailure('guest_count_required');
  }

  let partyMemberCount: number;
  try {
    partyMemberCount = await countPartyMembersForTable(admin, restaurantId, tableId);
  } catch (err) {
    return {
      ok: false,
      error: 'party_lookup_failed',
      status: 500,
      message: err instanceof Error ? err.message : String(err),
    };
  }
  if (!isPartyMemberCountAllowedForCheckout(partyMemberCount)) {
    return checkoutFailure('party_merge_required');
  }

  if (!validation.ok) {
    return checkoutFailure(validation.issue);
  }

  const existingSplitRow = await loadActiveBillSplitForSession({
    admin,
    restaurantId,
    sessionId,
  });

  const { count: collectedCount } = await admin
    .from('session_collected_payments')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId);

  let collectedPayments = parseSessionCollectedPayments(null);
  if ((collectedCount ?? 0) > 0) {
    const { data: collectedRows } = await admin
      .from('session_collected_payments')
      .select(SESSION_COLLECTED_PAYMENT_SELECT)
      .eq('restaurant_id', restaurantId)
      .eq('session_id', sessionId);
    collectedPayments = parseSessionCollectedPayments(collectedRows);
  }

  if (existingSplitRow) {
    const continuation = validateCheckoutContinuation({
      existing: existingSplitRow as BillSplit,
      payload: payloadForPersist,
      lineSpecs,
      hasCollectedLedger: collectedPayments.length > 0,
      collectedPayments,
    });
    if (!continuation.ok) {
      return checkoutFailure(continuation.issue);
    }
  }

  const orderIds = orders.map((order) => order.id);
  const { data: rpcData, error: rpcErr } = await admin.rpc('upsert_bill_split_request', {
    p_restaurant_id: restaurantId,
    p_session_id: sessionId,
    p_table_id: tableId,
    p_display_name: tableRow.display_name as string,
    p_order_ids: orderIds,
    p_split_mode: payloadForPersist.splitMode,
    p_persons: payloadForPersist.persons,
    p_result: payloadForPersist.result,
    p_total_amount: total,
    p_customer_nif: payloadForPersist.customerNif ?? null,
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
    return { ok: false, error: code, status: checkoutErrorStatus(code), message: rpcPayload?.message };
  }

  const billSplitId = rpcPayload.bill_split_id as string;
  if (!options?.skipAutomaticPreBill) {
    scheduleCallBillPreBillPrint({
      admin,
      restaurantId,
      sessionId,
      tableId,
      tableDisplayName: tableRow.display_name as string,
      billSplitId,
    });
  }

  return {
    ok: true,
    bill_split_id: billSplitId,
    result: (rpcPayload.result || payloadForPersist.result) as SplitResult[],
    total_amount: rpcPayload.total_amount ?? total,
    session_id: sessionId,
    table_name: tableRow.display_name as string,
    split_mode: payloadForPersist.splitMode,
  };
}

/**
 * Staff floor「呼叫结账」sole entry:
 * active preserved split → reopen same plan; none → mint whole_table.
 * Do not POST whole_table beside a live by_item/even plan.
 */
export async function ensureStaffCheckoutEntryForTable(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
  options?: { skipAutomaticPreBill?: boolean },
): Promise<CheckoutRequestResult> {
  const { data: session, error: sessionErr } = await admin
    .from('table_sessions')
    .select('id')
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
    return checkoutFailure('no_active_session');
  }

  const existing = await loadActiveBillSplitForSession({
    admin,
    restaurantId,
    sessionId: session.id as string,
  });

  if (existing) {
    const payload = checkoutPayloadFromBillSplit(existing);
    if (!payload) {
      return checkoutFailure('invalid_existing_split');
    }
    const alreadyRequested = existing.status === 'requested';
    return submitCheckoutRequestForTable(admin, restaurantId, tableId, payload, {
      skipAutomaticPreBill: options?.skipAutomaticPreBill === true || alreadyRequested,
      staffReopenActivePlan: true,
    });
  }

  return submitCheckoutRequestForTable(
    admin,
    restaurantId,
    tableId,
    buildWholeTableCheckoutPayload(0),
    { skipAutomaticPreBill: options?.skipAutomaticPreBill },
  );
}
