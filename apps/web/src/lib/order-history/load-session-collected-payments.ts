import type { SupabaseClient } from '@supabase/supabase-js';
import { groupCollectedPaymentsBySession } from '@/lib/checkout-settlement';
import {
  parseSessionCollectedPaymentsWithSession,
  SESSION_COLLECTED_PAYMENT_SELECT,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';

/** Ledger rows for closed sessions, grouped by session_id. */
export async function loadSessionCollectedPaymentsForOrderHistory(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
): Promise<Map<string, SessionCollectedPayment[]>> {
  const uniqueSessionIds = Array.from(new Set(sessionIds.filter(Boolean)));
  if (uniqueSessionIds.length === 0) return new Map();

  const { data, error } = await admin
    .from('session_collected_payments')
    .select(SESSION_COLLECTED_PAYMENT_SELECT)
    .eq('restaurant_id', restaurantId)
    .in('session_id', uniqueSessionIds)
    .order('created_at', { ascending: true });

  if (error || !data?.length) return new Map();

  return groupCollectedPaymentsBySession(parseSessionCollectedPaymentsWithSession(data));
}
