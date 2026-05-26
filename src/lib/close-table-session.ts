import type { SupabaseClient } from '@supabase/supabase-js';

export type CloseTableSessionResult =
  | { ok: true }
  | { ok: false; code: 'no_session' | 'update_failed' };

/** Close the active open/billing session for a table (owner dashboard or staff flows). */
export async function closeActiveTableSession(
  supabase: SupabaseClient,
  restaurantId: string,
  tableId: string,
  closedReason: 'waiter_closed' | 'owner_closed' = 'owner_closed',
): Promise<CloseTableSessionResult> {
  const { data: session, error: findError } = await supabase
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError || !session?.id) {
    return { ok: false, code: 'no_session' };
  }

  const { error: updError } = await supabase
    .from('table_sessions')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_reason: closedReason,
    })
    .eq('id', session.id);

  if (updError) {
    return { ok: false, code: 'update_failed' };
  }

  return { ok: true };
}
