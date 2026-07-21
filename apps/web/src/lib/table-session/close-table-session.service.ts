import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AUDIT_EVENT,
  recordAudit,
} from '@/lib/audit';
import { validateRequiredAbnormalReason } from '@/lib/audit/validate-abnormal-reason';
import type { UnpaidTableClosedAuditContext } from '@/lib/audit/builders/unpaid-table-closed';
import type { AuditActor } from '@/lib/audit/types';
import { auditMoney } from '@/lib/audit/money';
import {
  closeActiveTableSessionSettled,
  type CloseTableSettledResult,
} from '@/lib/close-active-table-session-with-cleanup';
import { purgeTablePartyMembership } from '@/lib/table-party-groups-server';
import { invokeCloseTableSessionManual } from '@/lib/table-session/close-table-session.repository';
import type { ManualCloseTableRpcPayload } from '@/lib/table-session/close-table-session.repository';
import type { CloseTableSessionClosedReason } from '@/lib/table-session/load-close-table-actor';

export type CloseTableSessionServiceInput = {
  admin: SupabaseClient;
  restaurantId: string;
  userId: string;
  actor: AuditActor;
  closedReason: 'owner_closed' | 'frontdesk_closed' | 'cashier_closed';
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

const UNPAID_CLOSE_FORBIDDEN_MESSAGE =
  '当前订单尚未完成收款，当前账号无权限直接关台。请联系前台处理。';

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
  | { ok: true; session_id: string }
  | {
      ok: false;
      code: 'no_session' | 'update_failed';
      message?: string;
    };

/** Cash/frontdesk checkout close — settled path with ledger + paid split, orders preserved. */
export async function closeTableSessionFrontdeskCheckout(input: {
  admin: SupabaseClient;
  restaurantId: string;
  tableId: string;
  userId: string;
  closedReason: CloseTableSessionClosedReason;
}): Promise<CloseTableSessionFrontdeskCheckoutResult> {
  const closed = await closeActiveTableSessionSettled(
    input.admin,
    input.restaurantId,
    input.tableId,
    input.closedReason,
    { closed_by_user_id: input.userId },
  );

  return mapSettledCloseResult(closed);
}

function mapSettledCloseResult(result: CloseTableSettledResult): CloseTableSessionFrontdeskCheckoutResult {
  if (result.ok) {
    return { ok: true, session_id: result.session_id };
  }
  return result;
}

export async function closeTableSessionManual(
  input: CloseTableSessionServiceInput,
): Promise<CloseTableSessionServiceResult> {
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
    closedReason: input.closedReason,
    confirmClose: input.confirmClose,
    unpaidReason: input.unpaidReason,
    unpaidReasonDetail: input.unpaidReasonDetail,
  });

  if (!rpcResult.ok) {
    if (rpcResult.code === 'forbidden') {
      return {
        ok: false,
        code: 'forbidden',
        message: UNPAID_CLOSE_FORBIDDEN_MESSAGE,
      };
    }
    return rpcResult;
  }

  if (rpcResult.is_unpaid_close && rpcResult.audit_snapshot) {
    const auditContext = snapshotToAuditContext(rpcResult.audit_snapshot);
    if (auditContext && input.unpaidReason?.trim()) {
      await recordAudit(input.admin, AUDIT_EVENT.UNPAID_TABLE_CLOSED, {
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
  return { ok: true, session_id: rpcResult.session_id };
}
