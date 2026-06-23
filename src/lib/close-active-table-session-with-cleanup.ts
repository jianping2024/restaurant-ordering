import type { SupabaseClient } from '@supabase/supabase-js';

export type CloseTableOperationalReason = 'waiter_closed' | 'owner_closed' | 'auto_nightly';

export type CloseTableSessionAudit = {
  /** Supabase auth user id for manual close (waiter/owner). Omit for auto_nightly. */
  closed_by_user_id?: string | null;
};

export type CloseTableOperationalResult =
  | { ok: true; session_id: string }
  | { ok: false; code: 'no_session' | 'update_failed'; message?: string };

/**
 * Single definition of “关台” for staff + owner + nightly auto-close:
 * 1) Cancel unpaid checkout rows for this session (bill_splits not paid).
 * 2) Void all order lines on this session and zero totals (operational cleanup; rows kept for audit).
 * 3) Close the table_sessions row (open/billing → closed).
 *
 * Requires service-role / admin client. See docs/table-session-close.zh.md.
 */
export async function closeActiveTableSessionWithOperationalCleanup(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
  closedReason: CloseTableOperationalReason,
  audit: CloseTableSessionAudit = {},
): Promise<CloseTableOperationalResult> {
  const { data: rpcData, error: rpcErr } = await admin.rpc('close_table_session_operational', {
    p_restaurant_id: restaurantId,
    p_table_id: tableId,
    p_closed_reason: closedReason,
    p_closed_by_user_id: audit.closed_by_user_id ?? null,
  });

  if (rpcErr) {
    return { ok: false, code: 'update_failed', message: rpcErr.message };
  }

  const payload = rpcData as {
    ok?: boolean;
    code?: string;
    message?: string;
    session_id?: string;
  } | null;

  if (!payload?.ok) {
    const code = payload?.code === 'no_session' ? 'no_session' : 'update_failed';
    return { ok: false, code, message: payload?.message };
  }

  if (!payload.session_id) {
    return { ok: false, code: 'update_failed', message: 'missing session_id' };
  }

  return { ok: true, session_id: payload.session_id };
}
