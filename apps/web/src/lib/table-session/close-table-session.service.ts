import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AUDIT_EVENT,
  scheduleRecordAudit,
} from '@/lib/audit';
import { validateRequiredAbnormalReason } from '@/lib/audit/validate-abnormal-reason';
import type { UnpaidTableClosedAuditContext } from '@/lib/audit/builders/unpaid-table-closed';
import type { AuditActor } from '@/lib/audit/types';
import { auditMoney } from '@/lib/audit/money';
import { sumBillableSessionTotal } from '@/lib/billable-session-lines';
import {
  closeActiveTableSessionSettled,
  type CloseTableSettledResult,
} from '@/lib/close-active-table-session-with-cleanup';
import { loadCustomerSessionOrders } from '@/lib/customer-session-context';
import { enqueueReceiptPrint } from '@/lib/order-receipt-enqueue';
import { purgeTablePartyMembership } from '@/lib/table-party-groups-server';
import { invokeCloseTableSessionManual } from '@/lib/table-session/close-table-session.repository';
import type { ManualCloseTableRpcPayload } from '@/lib/table-session/close-table-session.repository';
import { mayForceCloseTableForManualActor } from '@/lib/table-session/force-close-table-policy';
import {
  settledActorReasonToForced,
  type SettledCloseActorReason,
} from '@/lib/table-session/operational-close-reasons';

export type CloseTableSessionServiceInput = {
  admin: SupabaseClient;
  restaurantId: string;
  userId: string;
  actor: AuditActor;
  /** Dashboard actor reason (settled naming); mapped to *_forced for operational RPC. */
  closedReason: SettledCloseActorReason;
  tableId: string;
  confirmClose: boolean;
  unpaidReason?: string | null;
  unpaidReasonDetail?: string | null;
};

export type CloseTableSessionServiceResult =
  | { ok: true; session_id: string }
  | {
      ok: false;
      code:
        | 'invalid_reason'
        | 'reason_detail_required'
        | 'no_session'
        | 'close_confirm_required'
        | 'forbidden'
        | 'reason_required'
        | 'update_failed';
      message?: string;
      session_id?: string;
      reasons?: { checkout_requested: number };
    };

function validateUnpaidCloseReason(
  reason: string | null | undefined,
  reasonDetail: string | null | undefined,
): CloseTableSessionServiceResult | null {
  const trimmed = reason?.trim() ?? '';
  if (!trimmed) return null;

  const validation = validateRequiredAbnormalReason('unpaid_close', reason, reasonDetail);
  if (!validation.ok) {
    return { ok: false, code: validation.code };
  }
  return null;
}

function snapshotToAuditContext(
  snapshot: NonNullable<ManualCloseTableRpcPayload['audit_snapshot']>,
): UnpaidTableClosedAuditContext | null {
  if (!snapshot?.session_id || !snapshot.table_id) return null;
  return {
    sessionId: snapshot.session_id,
    tableId: snapshot.table_id,
    tableName: snapshot.table_name ?? null,
    sessionStatusBefore: snapshot.session_status_before ?? 'open',
    payableAmount: auditMoney(snapshot.payable_amount),
    paidAmount: auditMoney(snapshot.paid_amount),
    gap: auditMoney(snapshot.gap),
    hasUnpaidSplit: !!snapshot.has_unpaid_split,
  };
}

export type CloseTableSessionFrontdeskCheckoutResult =
  | {
      ok: true;
      session_id: string;
      /** Present when print was requested; false means enqueue failed after close. */
      print_ok?: boolean;
    }
  | {
      ok: false;
      code: 'no_session' | 'update_failed';
      message?: string;
    };

/** Cash/frontdesk checkout close — settled payable snapshot + close; optional best-effort bill print. */
export async function closeTableSessionFrontdeskCheckout(input: {
  admin: SupabaseClient;
  restaurantId: string;
  tableId: string;
  userId: string;
  actor: AuditActor;
  closedReason: SettledCloseActorReason;
  /** When true, enqueue checkout_bill after successful close (failure does not fail close). */
  printBill?: boolean;
}): Promise<CloseTableSessionFrontdeskCheckoutResult> {
  const { data: session } = await input.admin
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', input.restaurantId)
    .eq('table_id', input.tableId)
    .in('status', ['open', 'billing'])
    .maybeSingle();

  const sessionId = typeof session?.id === 'string' ? session.id : null;
  const orders = sessionId
    ? await loadCustomerSessionOrders({
        admin: input.admin,
        restaurantId: input.restaurantId,
        sessionId,
        ascending: true,
      })
    : [];
  const settledPayable = auditMoney(sumBillableSessionTotal(orders));

  const closed = await closeActiveTableSessionSettled(
    input.admin,
    input.restaurantId,
    input.tableId,
    input.closedReason,
    {
      closed_by_user_id: input.userId,
      settled_payable_amount: settledPayable,
    },
  );

  if (!closed.ok) {
    return mapSettledCloseResult(closed);
  }

  await bumpSessionOrdersForKitchenRealtime(input.admin, input.restaurantId, closed.session_id);

  const { data: tableRow } = await input.admin
    .from('restaurant_tables')
    .select('display_name')
    .eq('restaurant_id', input.restaurantId)
    .eq('id', input.tableId)
    .maybeSingle();
  const tableName =
    typeof tableRow?.display_name === 'string' && tableRow.display_name.trim()
      ? tableRow.display_name.trim()
      : '—';

  scheduleRecordAudit(input.admin, AUDIT_EVENT.TABLE_CLOSED, {
    restaurantId: input.restaurantId,
    actor: input.actor,
    context: {
      sessionId: closed.session_id,
      tableName,
      closeKind: 'frontdesk',
      amount: settledPayable,
    },
  });

  if (!input.printBill || !sessionId) {
    return { ok: true, session_id: closed.session_id };
  }

  const printOk = await enqueueCheckoutCloseBillPrint({
    admin: input.admin,
    restaurantId: input.restaurantId,
    tableId: input.tableId,
    sessionId,
  });

  return { ok: true, session_id: closed.session_id, print_ok: printOk };
}

async function enqueueCheckoutCloseBillPrint(params: {
  admin: SupabaseClient;
  restaurantId: string;
  tableId: string;
  sessionId: string;
}): Promise<boolean> {
  const [{ data: tableRow }, { data: restaurantRow }] = await Promise.all([
    params.admin
      .from('restaurant_tables')
      .select('display_name')
      .eq('restaurant_id', params.restaurantId)
      .eq('id', params.tableId)
      .maybeSingle(),
    params.admin
      .from('restaurants')
      .select('print_locale')
      .eq('id', params.restaurantId)
      .maybeSingle(),
  ]);

  const tableDisplayName =
    typeof tableRow?.display_name === 'string' && tableRow.display_name.trim()
      ? tableRow.display_name.trim()
      : null;
  if (!tableDisplayName) return false;

  try {
    const result = await enqueueReceiptPrint({
      admin: params.admin,
      restaurantId: params.restaurantId,
      printLocale: (restaurantRow?.print_locale as string | null) ?? null,
      sessionId: params.sessionId,
      tableId: params.tableId,
      tableDisplayName,
      variant: 'checkout_bill',
      printSource: 'staff_manual',
    });
    if (!result.ok) {
      return result.code === 'no_orders';
    }
    return true;
  } catch {
    return false;
  }
}

function mapSettledCloseResult(result: CloseTableSettledResult): CloseTableSessionFrontdeskCheckoutResult {
  if (result.ok) {
    return { ok: true, session_id: result.session_id };
  }
  return result;
}

/**
 * Close only writes `table_sessions`; kitchen boards subscribe to `orders` for CDC.
 * Bump `orders.updated_at` so Realtime doorbells clear closed sessions from the board
 * without interval polling (same GET refresh path as order mutations).
 */
async function bumpSessionOrdersForKitchenRealtime(
  admin: SupabaseClient,
  restaurantId: string,
  sessionId: string,
): Promise<void> {
  const { error } = await admin
    .from('orders')
    .update({ updated_at: new Date().toISOString() })
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId);
  if (error) {
    console.warn('[close-table-session] bump orders for kitchen realtime failed', error.message);
  }
}

export async function closeTableSessionManual(
  input: CloseTableSessionServiceInput,
): Promise<CloseTableSessionServiceResult> {
  if (!mayForceCloseTableForManualActor(input.closedReason)) {
    return { ok: false, code: 'forbidden' };
  }

  const reasonValidation = validateUnpaidCloseReason(
    input.unpaidReason,
    input.unpaidReasonDetail,
  );
  if (reasonValidation) {
    return reasonValidation;
  }

  const rpcResult = await invokeCloseTableSessionManual(input.admin, {
    restaurantId: input.restaurantId,
    tableId: input.tableId,
    operatorUserId: input.userId,
    closedReason: settledActorReasonToForced(input.closedReason),
    confirmClose: input.confirmClose,
    unpaidReason: input.unpaidReason,
    unpaidReasonDetail: input.unpaidReasonDetail,
  });

  if (!rpcResult.ok) {
    if (rpcResult.code === 'forbidden') {
      return { ok: false, code: 'forbidden' };
    }
    return rpcResult;
  }

  if (rpcResult.is_unpaid_close && rpcResult.audit_snapshot) {
    const auditContext = snapshotToAuditContext(rpcResult.audit_snapshot);
    if (auditContext && input.unpaidReason?.trim()) {
      scheduleRecordAudit(input.admin, AUDIT_EVENT.UNPAID_TABLE_CLOSED, {
        restaurantId: input.restaurantId,
        actor: input.actor,
        context: auditContext,
        reason: input.unpaidReason.trim(),
        reasonDetail: input.unpaidReasonDetail?.trim() || null,
      });
    }
  }

  // Manual RPC closes via SQL operational (not the JS wrapper) — purge here.
  await purgeTablePartyMembership(input.admin, input.restaurantId, input.tableId);
  await bumpSessionOrdersForKitchenRealtime(input.admin, input.restaurantId, rpcResult.session_id);
  return { ok: true, session_id: rpcResult.session_id };
}
