import type { SupabaseClient } from '@supabase/supabase-js';
import { groupOrdersBySession } from '@/lib/analytics/analytics.repository';
import { loadBillSplitsForOrderHistory } from '@/lib/order-history-bill-splits';
import { loadSessionCollectedPaymentsForOrderHistory } from '@/lib/order-history/load-session-collected-payments';
import type { Order } from '@/types';

/** Shared orders + bill-split + collected-payment loads for closed history sessions. */
export async function loadOrderHistorySessionPayloads(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
): Promise<{
  ordersBySession: Map<string, Order[]>;
  billSplitBySessionId: Awaited<ReturnType<typeof loadBillSplitsForOrderHistory>>;
  collectedPaymentsBySession: Awaited<
    ReturnType<typeof loadSessionCollectedPaymentsForOrderHistory>
  >;
} | null> {
  if (sessionIds.length === 0) {
    return {
      ordersBySession: new Map(),
      billSplitBySessionId: {},
      collectedPaymentsBySession: new Map(),
    };
  }

  const { data: orderRows, error: ordersError } = await admin
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .in('session_id', sessionIds)
    .order('created_at', { ascending: true });

  if (ordersError) return null;

  const [billSplitBySessionId, collectedPaymentsBySession] = await Promise.all([
    loadBillSplitsForOrderHistory(admin, restaurantId, sessionIds),
    loadSessionCollectedPaymentsForOrderHistory(admin, restaurantId, sessionIds),
  ]);

  return {
    ordersBySession: groupOrdersBySession((orderRows || []) as Order[]),
    billSplitBySessionId,
    collectedPaymentsBySession,
  };
}
