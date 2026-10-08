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
  const rows = (data || []) as BillSplit[];
  if (rows.length === 0) return rows;

  // Individual-checkout plans carry per-ticket call state (never the phone id).
  const { data: calls } = await client
    .from('bill_split_ticket_calls')
    .select('bill_split_id, ticket_key, name, state')
    .in(
      'bill_split_id',
      rows.map((row) => row.id),
    );
  const byPlan = new Map<string, NonNullable<BillSplit['individual_tickets']>>();
  for (const call of calls ?? []) {
    const list = byPlan.get(call.bill_split_id as string) ?? [];
    list.push({
      ticket_key: call.ticket_key as string,
      name: call.name as string,
      state: call.state as 'called' | 'unlocked',
    });
    byPlan.set(call.bill_split_id as string, list);
  }
  // Sole hydrate rule: attach call rows only for by_item (never whole_table/even).
  return rows.map((row) =>
    row.split_mode === 'by_item' && byPlan.has(row.id)
      ? { ...row, individual_tickets: byPlan.get(row.id) }
      : row,
  );
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
