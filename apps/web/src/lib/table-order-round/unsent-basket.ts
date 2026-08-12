import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sole check: source session has collecting/pending_confirm round with qty > 0
 * (waiter merge confirm warning).
 */
export async function sessionHasUnsentRoundBasket(
  client: SupabaseClient,
  sessionId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('table_order_rounds')
    .select('id, status, table_order_round_lines(qty)')
    .eq('session_id', sessionId)
    .in('status', ['collecting', 'pending_confirm']);

  if (error || !data?.length) return false;

  for (const round of data) {
    const lines = (round as { table_order_round_lines?: { qty: number }[] | null })
      .table_order_round_lines;
    if (!lines?.length) continue;
    if (lines.some((l) => Number(l.qty) > 0)) return true;
  }
  return false;
}
