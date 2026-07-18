import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildCheckoutRequestSummary,
  type CheckoutRequestSummary,
} from '@/lib/checkout-request-summary';
import {
  parseSessionCollectedPaymentsWithSession,
  SESSION_COLLECTED_PAYMENT_SELECT,
} from '@/lib/checkout-session-payments';
import { groupCollectedPaymentsBySession } from '@/lib/checkout-settlement';
import type { BillSplit } from '@/types';

const CHECKOUT_REQUESTS_LIMIT = 100;

const CHECKOUT_REQUEST_DETAIL_SELECT = '*';

async function loadCollectedBySessions(
  client: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
) {
  if (sessionIds.length === 0) return new Map();
  const { data, error } = await client
    .from('session_collected_payments')
    .select(SESSION_COLLECTED_PAYMENT_SELECT)
    .eq('restaurant_id', restaurantId)
    .in('session_id', sessionIds)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return groupCollectedPaymentsBySession(parseSessionCollectedPaymentsWithSession(data));
}

/** Pending checkout queue summaries for staff dashboard (SSR + API). */
export async function fetchCheckoutRequestsQueue(
  client: SupabaseClient,
  restaurantId: string,
): Promise<CheckoutRequestSummary[]> {
  const { data, error } = await client
    .from('bill_splits')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'requested')
    .not('session_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(CHECKOUT_REQUESTS_LIMIT);

  if (error) throw new Error(error.message);
  const rows = (data || []) as BillSplit[];
  const sessionIds = Array.from(
    new Set(rows.map((row) => row.session_id).filter((id): id is string => !!id)),
  );
  const collectedBySession = await loadCollectedBySessions(client, restaurantId, sessionIds);

  return rows
    .map((row) =>
      buildCheckoutRequestSummary(row, collectedBySession.get(row.session_id!) ?? []),
    )
    .filter((row): row is CheckoutRequestSummary => row != null);
}

export async function fetchCheckoutRequestDetail(
  client: SupabaseClient,
  restaurantId: string,
  billSplitId: string,
): Promise<BillSplit | null> {
  const id = billSplitId.trim();
  if (!id) return null;
  const { data, error } = await client
    .from('bill_splits')
    .select(CHECKOUT_REQUEST_DETAIL_SELECT)
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
    .eq('status', 'requested')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BillSplit | null) ?? null;
}

/** Nav badge count — same filters as {@link fetchCheckoutRequestsQueue}. */
export async function countCheckoutRequestsQueue(
  client: SupabaseClient,
  restaurantId: string,
): Promise<number> {
  const { count, error } = await client
    .from('bill_splits')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('status', 'requested')
    .not('session_id', 'is', null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}
