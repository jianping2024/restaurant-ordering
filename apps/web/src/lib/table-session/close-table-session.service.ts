import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AUDIT_EVENT,
  scheduleRecordAudit,
} from '@/lib/audit';
import { validateRequiredAbnormalReason } from '@/lib/audit/validate-abnormal-reason';
import type { UnpaidTableClosedAuditContext } from '@/lib/audit/builders/unpaid-table-closed';
import type { AuditActor } from '@/lib/audit/types';
import { auditMoney } from '@/lib/audit/money';
import { purgeTablePartyMembership } from '@/lib/table-party-groups-server';
import { invokeCloseTableSessionManual } from '@/lib/table-session/close-table-session.repository';
import type { ManualCloseTableRpcPayload } from '@/lib/table-session/close-table-session.repository';
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
  // Authz is tables.force_close only (resolveCloseTableSessionDeskActor).
  // closedReason → *_forced is audit labeling, not a second role whitelist.
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
