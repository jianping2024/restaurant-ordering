import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order, OrderItem } from '@/types';
import { voidActiveBuffetBaseLines } from '@/lib/buffet-order';
import { isBuffetBaseItem } from '@/lib/order-items';

export type CloseTableOperationalReason = 'waiter_closed' | 'owner_closed' | 'auto_nightly';

export type CloseTableSessionAudit = {
  /** Supabase auth user id for manual close (waiter/owner). Omit for auto_nightly. */
  closed_by_user_id?: string | null;
};

export type CloseTableOperationalResult =
  | { ok: true; session_id: string }
  | { ok: false; code: 'no_session' | 'update_failed'; message?: string };

/** Void every line (buffet base + menu) so kitchen / waiter boards show no active work. */
function voidAllLineItemsForForcedClose(items: OrderItem[]): OrderItem[] {
  const withBuffet = voidActiveBuffetBaseLines(items);
  const now = new Date().toISOString();
  return withBuffet.map((item) => {
    if (isBuffetBaseItem(item)) return item;
    if (item.item_status === 'voided') return item;
    return { ...item, item_status: 'voided' as const, voided_at: now };
  });
}

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

  const { error: splitErr } = await admin
    .from('bill_splits')
    .update({ status: 'cancelled' })
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId)
    .in('status', ['pending', 'confirmed', 'requested']);

  if (splitErr) {
    return { ok: false, code: 'update_failed', message: splitErr.message };
  }

  const { data: orderRows, error: ordersErr } = await admin
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId)
    .in('status', ['pending', 'cooking', 'done']);

  if (ordersErr) {
    return { ok: false, code: 'update_failed', message: ordersErr.message };
  }

  const nowIso = new Date().toISOString();
  for (const row of (orderRows || []) as Order[]) {
    const nextItems = voidAllLineItemsForForcedClose(row.items || []);
    const { error: orderUpdErr } = await admin
      .from('orders')
      .update({
        items: nextItems,
        status: 'done',
        total_amount: 0,
        updated_at: nowIso,
      })
      .eq('id', row.id)
      .eq('restaurant_id', restaurantId);

    if (orderUpdErr) {
      return { ok: false, code: 'update_failed', message: orderUpdErr.message };
    }
  }

  const { error: sessionErr } = await admin
    .from('table_sessions')
    .update({
      status: 'closed',
      closed_at: nowIso,
      closed_reason: closedReason,
      closed_by_user_id: audit.closed_by_user_id ?? null,
    })
    .eq('id', sessionId);

  if (sessionErr) {
    return { ok: false, code: 'update_failed', message: sessionErr.message };
  }

  return { ok: true, session_id: sessionId };
}
