import type { SupabaseClient } from '@supabase/supabase-js';

export type ManualCloseTableRpcPayload = {
  ok?: boolean;
  code?: string;
  message?: string;
  session_id?: string;
  is_unpaid_close?: boolean;
  reasons?: { checkout_requested?: number };
  audit_snapshot?: {
    session_id?: string;
    table_id?: string;
    table_name?: string | null;
    session_status_before?: string;
    payable_amount?: number | string;
    paid_amount?: number | string;
    gap?: number | string;
    has_unpaid_split?: boolean;
  };
};

export type ManualCloseTableResult =
  | {
      ok: true;
      session_id: string;
      is_unpaid_close: boolean;
      audit_snapshot?: ManualCloseTableRpcPayload['audit_snapshot'];
    }
  | {
      ok: false;
      code:
        | 'no_session'
        | 'close_confirm_required'
        | 'forbidden'
        | 'reason_required'
        | 'update_failed';
      message?: string;
      session_id?: string;
      reasons?: { checkout_requested: number };
      is_unpaid_close?: boolean;
    };

export async function invokeCloseTableSessionManual(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    tableId: string;
    operatorUserId: string;
    closedReason: string;
    confirmClose: boolean;
    unpaidReason?: string | null;
    unpaidReasonDetail?: string | null;
  },
): Promise<ManualCloseTableResult> {
  const { data, error } = await admin.rpc('close_table_session_manual', {
    p_restaurant_id: params.restaurantId,
    p_table_id: params.tableId,
    p_operator_user_id: params.operatorUserId,
    p_closed_reason: params.closedReason,
    p_confirm_close: params.confirmClose,
    p_unpaid_reason: params.unpaidReason ?? null,
    p_unpaid_reason_detail: params.unpaidReasonDetail ?? null,
  });

  if (error) {
    return { ok: false, code: 'update_failed', message: error.message };
  }

  const payload = (data ?? {}) as ManualCloseTableRpcPayload;
  if (!payload.ok) {
    const code = payload.code ?? 'update_failed';
    if (code === 'close_confirm_required') {
      return {
        ok: false,
        code,
        session_id: payload.session_id,
        reasons: {
          checkout_requested: payload.reasons?.checkout_requested ?? 0,
        },
      };
    }
    if (code === 'reason_required') {
      return {
        ok: false,
        code,
        session_id: payload.session_id,
        is_unpaid_close: true,
      };
    }
    if (code === 'forbidden') {
      return { ok: false, code, message: payload.message };
    }
    if (code === 'no_session') {
      return { ok: false, code, message: payload.message };
    }
    return { ok: false, code: 'update_failed', message: payload.message };
  }

  if (!payload.session_id) {
    return { ok: false, code: 'update_failed', message: 'missing session_id' };
  }

  return {
    ok: true,
    session_id: payload.session_id,
    is_unpaid_close: !!payload.is_unpaid_close,
    audit_snapshot: payload.audit_snapshot,
  };
}
