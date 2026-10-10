import type { SupabaseClient } from '@supabase/supabase-js';
import { markBillSplitStaffCheckout } from '@/lib/bill-split-staff-checkout';
import { checkoutErrorStatus } from '@/lib/checkout-error-codes';
import type { SplitPerson, SplitResult } from '@/types';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { AUDIT_EVENT, scheduleRecordAudit, type AuditActor } from '@/lib/audit';
import { purgeTablePartyMembership } from '@/lib/table-party-groups-server';
import { enqueueCashDrawerOpen } from '@/lib/cash-drawer-enqueue';
import {
  parseBillSyncPaymentLines,
  parseBillSyncPaymentMethod,
  shouldOpenCashDrawerForTender,
  type BillSyncPaymentLine,
  type BillSyncPaymentMethod,
} from '@/lib/bill-sync-payload';
import { loadCustomerSessionOrders } from '@/lib/customer-session-context';
import { deriveBillView } from '@/lib/customer-bill-sync';
import {
  buildByItemAllocationsFromPersons,
  getByItemLineStatusFromShares,
  isByItemLineComplete,
} from '@/lib/bill-split-by-item';
import { parseOptionalPartyId, splitPartyKey } from '@/lib/split-party-id';

export {
  applyDiscountToRows,
  checkoutPayableAmount,
  clampCheckoutDiscountRate,
  normalizeSplitRows,
  sumSplitRowAmounts,
} from '@/lib/checkout-split-math';

export type ConfirmPaymentCollectionRecord = SessionCollectedPayment;

export type ConfirmPaymentResult =
  | {
      ok: true;
      all_paid: boolean;
      result: SplitResult[];
      final_amount: number;
      collection: ConfirmPaymentCollectionRecord | null;
    }
  | {
      ok: false;
      status: number;
      code: string;
      message?: string;
    };

type ConfirmBillSplitPaymentRpc = {
  ok: boolean;
  code?: string;
  message?: string;
  all_paid?: boolean;
  result?: SplitResult[];
  final_amount?: number;
  session_id?: string | null;
  table_id?: string;
  display_name?: string;
  order_ids?: unknown;
  row_name?: string;
  row_amount?: number;
  collected_payment_id?: string | null;
  confirmed_party_id?: string | null;
  confirmed_person_index?: number | null;
  payment_method?: string | null;
  newly_paid?: boolean;
  should_print_split?: boolean;
  should_print_final?: boolean;
  should_close_session?: boolean;
};

function parseCollectionRecord(
  payload: ConfirmBillSplitPaymentRpc,
): ConfirmPaymentCollectionRecord | null {
  if (typeof payload.collected_payment_id !== 'string' || !payload.collected_payment_id) {
    return null;
  }
  const partyId = parseOptionalPartyId(payload.confirmed_party_id) ?? null;
  const personIndex = payload.confirmed_person_index;
  const indexOk =
    typeof personIndex === 'number' && Number.isInteger(personIndex) && personIndex >= 0
      ? personIndex
      : null;
  if (!partyId && indexOk == null) {
    return null;
  }
  return {
    id: payload.collected_payment_id,
    party_id: partyId,
    person_index: indexOk,
    person_name: payload.row_name ?? '',
    amount: Number(payload.row_amount) || 0,
    created_at: new Date().toISOString(),
    payment_method: parseBillSyncPaymentMethod(payload.payment_method),
    payment_lines: parseBillSyncPaymentLines(
      (payload as { payment_lines?: unknown }).payment_lines,
    ),
  };
}

/**
 * By-item partial collect must not close the table and must stamp staff takeover.
 * Hold when other result rows (not the one being collected) are still unpaid, or the
 * pool still has unallocated dishes. Fail closed when the split cannot be read.
 * Even / non-by_item return false.
 */
export async function shouldHoldCheckoutSessionOpen(params: {
  admin: SupabaseClient;
  restaurantId: string;
  billSplitId: string;
  /** Seat being collected (party_id preferred). */
  partyId: string;
}): Promise<boolean> {
  const { admin, restaurantId, billSplitId, partyId } = params;
  try {
    const { data, error } = await admin
      .from('bill_splits')
      .select('split_mode, persons, result, session_id')
      .eq('id', billSplitId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (error || !data) return true;
    if (data.split_mode !== 'by_item' || !data.session_id) return false;
    const result = Array.isArray(data.result) ? (data.result as SplitResult[]) : [];
    const want = splitPartyKey(partyId, '');
    const personIndex = result.findIndex(
      (row) => splitPartyKey(row.party_id, row.name) === want || row.party_id === partyId,
    );
    if (result.some((row, index) => index !== personIndex && !row.paid)) return true;
    const orders = await loadCustomerSessionOrders({
      admin,
      restaurantId,
      sessionId: data.session_id as string,
      ascending: true,
    });
    const { lineSpecs } = deriveBillView(orders);
    const persons = Array.isArray(data.persons) ? (data.persons as SplitPerson[]) : [];
    const allocations = buildByItemAllocationsFromPersons(persons, lineSpecs);
    for (const spec of lineSpecs) {
      const status = getByItemLineStatusFromShares(spec, allocations[spec.key] ?? []);
      if (!isByItemLineComplete(status)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export async function confirmBillSplitPayment(params: {
  admin: SupabaseClient;
  restaurantId: string;
  billSplitId: string;
  partyId: string;
  paymentMethod: BillSyncPaymentMethod;
  paymentLines?: BillSyncPaymentLine[] | null;
  collectedAmount?: number;
  /** One collect attempt; a retry with the same id replays the stored payment (never collects twice). */
  clientRequestId: string;
  createdByUserId?: string;
  actor?: AuditActor;
  /** Server-computed. Partial by-item must not close the session. */
  holdSessionOpen?: boolean;
}): Promise<ConfirmPaymentResult> {
  const {
    admin,
    restaurantId,
    billSplitId,
    partyId,
    paymentMethod,
    paymentLines = null,
    collectedAmount,
    clientRequestId,
    createdByUserId,
    actor,
    holdSessionOpen = false,
  } = params;

  const { data: rpcData, error: rpcErr } = await admin.rpc('confirm_bill_split_payment', {
    p_restaurant_id: restaurantId,
    p_bill_split_id: billSplitId,
    p_party_id: partyId,
    p_collected_amount: collectedAmount ?? null,
    p_created_by_user_id: createdByUserId ?? null,
    p_payment_method: paymentMethod,
    p_hold_open: holdSessionOpen,
    p_payment_lines: paymentLines ?? null,
    p_client_request_id: clientRequestId,
  });

  if (rpcErr) {
    return {
      ok: false,
      status: 500,
      code: 'bill_update_failed',
      message: rpcErr.message,
    };
  }

  const payload = rpcData as ConfirmBillSplitPaymentRpc | null;
  if (!payload?.ok) {
    const code = payload?.code ?? 'bill_update_failed';
    return {
      ok: false,
      status: checkoutErrorStatus(code),
      code,
      message: payload?.message,
    };
  }

  const result = (payload.result || []) as SplitResult[];
  const allPaid = !!payload.all_paid;
  if (holdSessionOpen && !allPaid) {
    const marked = await markBillSplitStaffCheckout(admin, restaurantId, billSplitId);
    if (!marked.ok) {
      console.warn('[confirm-payment] mark staff checkout failed', marked.message);
    }
  }
  const finalAmount = Number(payload.final_amount) || 0;
  const rowAmount = Number(payload.row_amount) || 0;
  const collectedPaymentId =
    typeof payload.collected_payment_id === 'string' ? payload.collected_payment_id : null;
  const collection = parseCollectionRecord(payload);
  const tableName =
    typeof payload.display_name === 'string' && payload.display_name.trim()
      ? payload.display_name.trim()
      : '—';
  const sessionId =
    typeof payload.session_id === 'string' && payload.session_id ? payload.session_id : null;

  if (actor && payload.newly_paid) {
    scheduleRecordAudit(admin, AUDIT_EVENT.PAYMENT_CONFIRMED, {
      restaurantId,
      actor,
      context: {
        billSplitId,
        tableName,
        personName: collection?.person_name || payload.row_name || '—',
        amount: rowAmount,
        allPaid,
        sessionId,
      },
    });

    if (payload.should_close_session && sessionId) {
      scheduleRecordAudit(admin, AUDIT_EVENT.TABLE_CLOSED, {
        restaurantId,
        actor,
        context: {
          sessionId,
          tableName,
          closeKind: 'paid',
          amount: finalAmount,
        },
      });
    }
  }

  if (payload.should_close_session && typeof payload.table_id === 'string' && payload.table_id) {
    await purgeTablePartyMembership(admin, restaurantId, payload.table_id);
  }

  if (
    payload.newly_paid &&
    shouldOpenCashDrawerForTender(paymentMethod, paymentLines)
  ) {
    void enqueueCashDrawerOpen({
      admin,
      restaurantId,
      sessionId:
        typeof payload.session_id === 'string' && payload.session_id
          ? payload.session_id
          : null,
      collectedPaymentId,
    });
  }

  return {
    ok: true,
    all_paid: allPaid,
    result,
    final_amount: finalAmount,
    collection,
  };
}
