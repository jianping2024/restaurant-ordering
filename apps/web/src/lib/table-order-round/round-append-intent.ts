import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sole mint of sushi-round finalize append intent id (`table_order_rounds.append_client_request_id`).
 * First writer wins via conditional update; concurrent losers re-read the winner's id so all
 * finalize callers share one idempotency key (no double append / double station_ticket).
 */
export async function resolveRoundAppendClientRequestId(params: {
  admin: SupabaseClient;
  roundId: string;
  existingId: string | null | undefined;
}): Promise<string> {
  const existing =
    typeof params.existingId === 'string' ? params.existingId.trim() : '';
  if (existing) return existing;

  const minted = randomUUID();
  const nowIso = new Date().toISOString();
  const { data: won } = await params.admin
    .from('table_order_rounds')
    .update({ append_client_request_id: minted, updated_at: nowIso })
    .eq('id', params.roundId)
    .is('append_client_request_id', null)
    .select('append_client_request_id')
    .maybeSingle();

  const wonId = won?.append_client_request_id;
  if (typeof wonId === 'string' && wonId.trim()) return wonId.trim();

  const { data: again } = await params.admin
    .from('table_order_rounds')
    .select('append_client_request_id')
    .eq('id', params.roundId)
    .maybeSingle();
  const fromRow = again?.append_client_request_id;
  if (typeof fromRow === 'string' && fromRow.trim()) return fromRow.trim();

  return minted;
}
