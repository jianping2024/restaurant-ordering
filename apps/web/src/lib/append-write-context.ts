import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order, OrderItem } from '@/types';
import { guestOrderingEnabled } from '@/lib/guest-table-ordering';
import { findActiveTableSession, type TableSessionRef } from '@/lib/table-session-open';

const ACTIVE_ORDER_STATUSES = ['pending', 'cooking', 'done'] as const;

type SessionOrderRow = Pick<Order, 'id' | 'status' | 'items' | 'created_at'>;

export type AppendWriteContext = {
  session: TableSessionRef;
  sessionOrders: SessionOrderRow[];
  openOrder: { id: string; items: OrderItem[] } | null;
};

export type LoadAppendWriteContextResult =
  | { ok: true; context: AppendWriteContext }
  | { ok: false; status: number; error: string };

function pickLatestOpenOrder(rows: SessionOrderRow[]): { id: string; items: OrderItem[] } | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    const aAt = a.created_at || '';
    const bAt = b.created_at || '';
    return bAt.localeCompare(aAt);
  });
  const latest = sorted[0];
  if (!latest?.id) return null;
  return { id: latest.id, items: (latest.items || []) as OrderItem[] };
}

/**
 * Single read path for append: active session + session orders (gate + merge target).
 * Buffet gate scans all session orders; merge writes the latest order by created_at.
 */
export async function loadAppendWriteContext(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<LoadAppendWriteContextResult> {
  const session = await findActiveTableSession(admin, restaurantId, tableId);
  if (!session) {
    return { ok: false, status: 403, error: 'buffet_required' };
  }
  if (session.status === 'billing') {
    return { ok: false, status: 409, error: 'session_billing' };
  }

  const { data: sessionOrders, error } = await admin
    .from('orders')
    .select('id, status, items, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('session_id', session.id)
    .in('status', [...ACTIVE_ORDER_STATUSES]);

  if (error) {
    return { ok: false, status: 500, error: 'order_query_failed' };
  }

  const rows = (sessionOrders || []) as SessionOrderRow[];
  if (!guestOrderingEnabled(session, rows as Order[])) {
    return { ok: false, status: 403, error: 'buffet_required' };
  }

  return {
    ok: true,
    context: {
      session,
      sessionOrders: rows,
      openOrder: pickLatestOpenOrder(rows),
    },
  };
}
