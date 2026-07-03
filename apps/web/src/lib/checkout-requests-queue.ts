import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillSplit } from '@/types';

const CHECKOUT_REQUESTS_LIMIT = 100;

/** Pending checkout queue rows for staff dashboard (SSR + admin API). */
export async function fetchCheckoutRequestsQueue(
  client: SupabaseClient,
  restaurantId: string,
): Promise<BillSplit[]> {
  const { data, error } = await client
    .from('bill_splits')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'requested')
    .not('session_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(CHECKOUT_REQUESTS_LIMIT);

  if (error) throw new Error(error.message);
  return (data || []) as BillSplit[];
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
