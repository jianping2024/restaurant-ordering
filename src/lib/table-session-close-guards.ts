import type { SupabaseClient } from '@supabase/supabase-js';
import {
  closeActiveTableSessionWithOperationalCleanup,
  type CloseTableOperationalReason,
} from '@/lib/close-active-table-session-with-cleanup';

export type TableSessionCloseConfirmReasons = {
  /** For UI: stronger warning when customer already requested checkout. */
  checkout_requested: number;
};

export type TableSessionCloseGuardOptions = {
  /** Manual close must pass explicit confirm (alias: confirm_checkout_close). */
  confirm_close?: boolean;
  confirm_checkout_close?: boolean;
  closed_by_user_id?: string | null;
};

export type TableSessionCloseGuardResult =
  | { ok: true; session_id: string }
  | { ok: false; code: 'no_session'; message?: string }
  | {
      ok: false;
      code: 'close_confirm_required';
      session_id: string;
      reasons: TableSessionCloseConfirmReasons;
    };

export function isManualCloseConfirmed(options: TableSessionCloseGuardOptions = {}): boolean {
  return options.confirm_close === true || options.confirm_checkout_close === true;
}

/**
 * Preflight for waiter/owner manual close: always requires confirm_close.
 * Auto-close calls closeActiveTableSessionWithOperationalCleanup directly (no guard).
 */
export async function evaluateTableSessionCloseGuards(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
  options: TableSessionCloseGuardOptions = {},
): Promise<TableSessionCloseGuardResult> {
  const { data: session, error: findError } = await admin
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError || !session?.id) {
    return { ok: false, code: 'no_session', message: findError?.message };
  }

  const sessionId = session.id as string;

  const { count: checkoutRequestedCount, error: splitErr } = await admin
    .from('bill_splits')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId)
    .eq('status', 'requested');

  if (splitErr) {
    return { ok: false, code: 'no_session', message: splitErr.message };
  }

  const reasons: TableSessionCloseConfirmReasons = {
    checkout_requested: checkoutRequestedCount ?? 0,
  };

  if (!isManualCloseConfirmed(options)) {
    return { ok: false, code: 'close_confirm_required', session_id: sessionId, reasons };
  }

  return { ok: true, session_id: sessionId };
}

export type CloseTableSessionWithGuardResult =
  | { ok: true; session_id: string }
  | {
      ok: false;
      code: 'no_session' | 'close_confirm_required' | 'update_failed';
      message?: string;
      session_id?: string;
      reasons?: TableSessionCloseConfirmReasons;
    };

/** Guard preflight then operational cleanup (waiter / owner manual close). */
export async function closeTableSessionWithCheckoutGuard(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
  closedReason: CloseTableOperationalReason,
  options: TableSessionCloseGuardOptions = {},
): Promise<CloseTableSessionWithGuardResult> {
  const guard = await evaluateTableSessionCloseGuards(admin, restaurantId, tableId, options);
  if (!guard.ok) {
    if (guard.code === 'close_confirm_required') {
      return {
        ok: false,
        code: guard.code,
        session_id: guard.session_id,
        reasons: guard.reasons,
      };
    }
    return { ok: false, code: guard.code, message: guard.message };
  }

  const result = await closeActiveTableSessionWithOperationalCleanup(
    admin,
    restaurantId,
    tableId,
    closedReason,
    { closed_by_user_id: options.closed_by_user_id ?? null },
  );

  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message };
  }

  return { ok: true, session_id: result.session_id };
}
