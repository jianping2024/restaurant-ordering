import type { SupabaseClient } from '@supabase/supabase-js';
import { purgeTablePartyMembership } from '@/lib/table-party-groups-server';
import type { OperationalCloseReason } from '@/lib/table-session/operational-close-reasons';

export type CloseTableOperationalReason = OperationalCloseReason;

export type CloseTableSettledReason = 'owner_closed' | 'frontdesk_closed' | 'cashier_closed';

export type CloseTableSessionAudit = {
  /** Supabase auth user id for manual close (waiter/owner). Omit for auto_nightly. */
  closed_by_user_id?: string | null;
};

export type CloseTableOperationalResult =
  | { ok: true; session_id: string }
  | { ok: false; code: 'no_session' | 'update_failed'; message?: string };

export type CloseTableSettledResult =
  | { ok: true; session_id: string }
  | {
      ok: false;
      code: 'no_session' | 'update_failed';
      message?: string;
    };

type CloseTableRpcPayload = {
  ok?: boolean;
  code?: string;
  message?: string;
  session_id?: string;
};

function mapSettledRpcPayload(payload: CloseTableRpcPayload | null): CloseTableSettledResult {
  if (!payload?.ok) {
    const code = payload?.code;
    if (code === 'no_session') {
      return { ok: false, code, message: payload?.message };
    }
    return {
      ok: false,
      code: 'update_failed',
      message: payload?.message ?? code ?? 'update_failed',
    };
  }

  if (!payload.session_id) {
    return { ok: false, code: 'update_failed', message: 'missing session_id' };
  }

  return {
    ok: true,
    session_id: payload.session_id,
  };
}

/**
 * Settled close for frontdesk/cashier checkout: cancel unpaid splits, preserve orders,
 * close session. Revenue uses preserved order totals — no invented paid split/ledger.
 * See docs/table-session-close.zh.md.
 */
export async function closeActiveTableSessionSettled(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
  closedReason: CloseTableSettledReason,
  audit: CloseTableSessionAudit = {},
): Promise<CloseTableSettledResult> {
  const { data: rpcData, error: rpcErr } = await admin.rpc('close_table_session_settled', {
    p_restaurant_id: restaurantId,
    p_table_id: tableId,
    p_closed_reason: closedReason,
    p_closed_by_user_id: audit.closed_by_user_id ?? null,
  });

  if (rpcErr) {
    return { ok: false, code: 'update_failed', message: rpcErr.message };
  }

  const result = mapSettledRpcPayload(rpcData as CloseTableRpcPayload | null);
  if (!result.ok) {
    return result;
  }

  await purgeTablePartyMembership(admin, restaurantId, tableId);
  return result;
}

/**
 * Operational force/nightly close: cancel unpaid splits, close session, preserve orders.
 * Revenue exclusion is by closed_reason (operational set) / UNPAID_TABLE_CLOSED — not voiding.
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

  const payload = rpcData as CloseTableRpcPayload | null;

  if (!payload?.ok) {
    const code = payload?.code === 'no_session' ? 'no_session' : 'update_failed';
    return { ok: false, code, message: payload?.message };
  }

  if (!payload.session_id) {
    return { ok: false, code: 'update_failed', message: 'missing session_id' };
  }

  await purgeTablePartyMembership(admin, restaurantId, tableId);
  return { ok: true, session_id: payload.session_id };
}
