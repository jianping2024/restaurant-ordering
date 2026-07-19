import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildOrderHistorySessionView,
  toOrderHistoryDetail,
  type OrderHistoryClosedSession,
} from '@/lib/order-history/build-session-view';
import { loadOrderHistorySessionPayloads } from '@/lib/order-history/load-session-payloads';
import { resolveOpenedByNames } from '@/lib/order-history/resolve-opened-by';
import type { OrderHistoryDetail } from '@/lib/order-history/types';

export type LoadOrderHistoryDetailResult =
  | { ok: true; detail: OrderHistoryDetail }
  | { ok: false; error: 'not_found' | 'load_failed' };

export async function loadOrderHistoryDetail(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    ownerId: string;
    restaurantName: string;
    sessionId: string;
  },
): Promise<LoadOrderHistoryDetailResult> {
  const sessionId = params.sessionId.trim();
  if (!sessionId) return { ok: false, error: 'not_found' };

  const { data: sessionRow, error: sessionError } = await admin
    .from('table_sessions')
    .select('id, table_id, closed_at, opened_by_user_id')
    .eq('restaurant_id', params.restaurantId)
    .eq('id', sessionId)
    .eq('status', 'closed')
    .maybeSingle();

  if (sessionError) return { ok: false, error: 'load_failed' };
  if (!sessionRow) return { ok: false, error: 'not_found' };

  const session = sessionRow as OrderHistoryClosedSession;
  const payloads = await loadOrderHistorySessionPayloads(admin, params.restaurantId, [
    session.id,
  ]);
  if (!payloads) return { ok: false, error: 'load_failed' };

  const openerNames = session.opened_by_user_id
    ? await resolveOpenedByNames(admin, {
        restaurantId: params.restaurantId,
        ownerId: params.ownerId,
        restaurantName: params.restaurantName,
        userIds: [session.opened_by_user_id],
      })
    : new Map<string, string>();

  const openedByName = session.opened_by_user_id
    ? openerNames.get(session.opened_by_user_id) ?? null
    : null;

  const detail = toOrderHistoryDetail(
    buildOrderHistorySessionView({
      session,
      orders: payloads.ordersBySession.get(session.id) || [],
      openedByName,
      billSplit: payloads.billSplitBySessionId[session.id],
      collectedPayments: payloads.collectedPaymentsBySession.get(session.id) ?? [],
    }),
  );

  return { ok: true, detail };
}
