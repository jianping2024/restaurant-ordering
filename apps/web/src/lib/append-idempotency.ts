import type { SupabaseClient } from '@supabase/supabase-js';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export type AppendIdempotencyCompleted = {
  orderId: string;
  batchId: string;
  hadDoneBefore: boolean;
  isFirstOrder: boolean;
};

export type ClaimAppendIdempotencyResult =
  | { kind: 'claimed' }
  | { kind: 'replay'; result: AppendIdempotencyCompleted }
  | { kind: 'in_progress' }
  | { kind: 'error'; status: number; error: string };

type IdempotencyRow = {
  status: string;
  order_id: string | null;
  batch_id: string | null;
  had_done_before: boolean | null;
  is_first_order: boolean | null;
};

/** Require a UUID client_request_id (same normalization as table_id). */
export function parseAppendClientRequestId(raw: unknown): string | null {
  return parseTableIdParam(raw);
}

function completedFromRow(row: IdempotencyRow): AppendIdempotencyCompleted | null {
  if (row.status !== 'completed') return null;
  if (!row.order_id || !row.batch_id) return null;
  return {
    orderId: row.order_id,
    batchId: row.batch_id,
    hadDoneBefore: row.had_done_before === true,
    isFirstOrder: row.is_first_order === true,
  };
}

async function loadIdempotencyRow(
  admin: SupabaseClient,
  sessionId: string,
  clientRequestId: string,
): Promise<{ ok: true; row: IdempotencyRow | null } | { ok: false }> {
  const { data, error } = await admin
    .from('order_append_idempotency')
    .select('status, order_id, batch_id, had_done_before, is_first_order')
    .eq('session_id', sessionId)
    .eq('client_request_id', clientRequestId)
    .maybeSingle();
  if (error) return { ok: false };
  return { ok: true, row: (data as IdempotencyRow | null) ?? null };
}

/**
 * Claim an append intent before writing items, or return a completed replay / in-progress.
 * Unique(session_id, client_request_id) is the concurrency gate.
 * Pending rows are never reclaimed for a second write (avoids double-append after a crash).
 */
export async function claimAppendIdempotency(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
  clientRequestId: string;
}): Promise<ClaimAppendIdempotencyResult> {
  const { admin, restaurantId, sessionId, clientRequestId } = params;

  const existing = await loadIdempotencyRow(admin, sessionId, clientRequestId);
  if (!existing.ok) {
    return { kind: 'error', status: 500, error: 'idempotency_query_failed' };
  }

  if (existing.row) {
    const replay = completedFromRow(existing.row);
    if (replay) return { kind: 'replay', result: replay };
    return { kind: 'in_progress' };
  }

  const { error: insErr } = await admin.from('order_append_idempotency').insert({
    restaurant_id: restaurantId,
    session_id: sessionId,
    client_request_id: clientRequestId,
    status: 'pending',
  });

  if (!insErr) return { kind: 'claimed' };

  // Concurrent claim won the unique race — re-read.
  const again = await loadIdempotencyRow(admin, sessionId, clientRequestId);
  if (!again.ok) {
    return { kind: 'error', status: 500, error: 'idempotency_query_failed' };
  }
  if (!again.row) {
    return { kind: 'error', status: 500, error: 'idempotency_claim_failed' };
  }
  const replay = completedFromRow(again.row);
  if (replay) return { kind: 'replay', result: replay };
  return { kind: 'in_progress' };
}

export async function completeAppendIdempotency(params: {
  admin: SupabaseClient;
  sessionId: string;
  clientRequestId: string;
  orderId: string;
  batchId: string;
  hadDoneBefore: boolean;
  isFirstOrder: boolean;
  lineCount: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await params.admin
    .from('order_append_idempotency')
    .update({
      status: 'completed',
      order_id: params.orderId,
      batch_id: params.batchId,
      had_done_before: params.hadDoneBefore,
      is_first_order: params.isFirstOrder,
      line_count: params.lineCount,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', params.sessionId)
    .eq('client_request_id', params.clientRequestId)
    .eq('status', 'pending');

  if (error) return { ok: false, error: 'idempotency_complete_failed' };
  return { ok: true };
}

/** Release a pending claim so the same client_request_id can retry after a failed write. */
export async function releaseAppendIdempotencyClaim(params: {
  admin: SupabaseClient;
  sessionId: string;
  clientRequestId: string;
}): Promise<void> {
  await params.admin
    .from('order_append_idempotency')
    .delete()
    .eq('session_id', params.sessionId)
    .eq('client_request_id', params.clientRequestId)
    .eq('status', 'pending');
}

export function logOrderAppendEvent(
  event: string,
  fields: Record<string, string | number | boolean | undefined | null>,
): void {
  const payload: Record<string, string | number | boolean> = { event };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    payload[key] = value;
  }
  console.info('[order_append]', JSON.stringify(payload));
}
