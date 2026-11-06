import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/** Agent must pull & ack fiscal wipe before Mesa runtime wipe continues. */
export const FISCAL_CLEAR_JOB_TTL_MS = 90_000;
export const FISCAL_CLEAR_WAIT_MS = 45_000;
export const FISCAL_CLEAR_POLL_MS = 1_000;

export type ClearRestaurantBusinessDataResult =
  | {
      ok: true;
      restaurantId: string;
      fiscal: 'cleared' | 'skipped_no_agent';
    }
  | {
      ok: false;
      error:
        | 'fiscal_clear_timeout'
        | 'fiscal_clear_failed'
        | 'fiscal_clear_enqueue_failed'
        | 'clear_failed';
      detail?: string;
    };

async function restaurantHasActiveAgent(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('print_agent_devices')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .is('revoked_at', null)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

async function waitFiscalClearJob(
  admin: SupabaseClient,
  restaurantId: string,
  jobId: string,
): Promise<{ ok: true } | { ok: false; error: 'fiscal_clear_timeout' | 'fiscal_clear_failed'; detail?: string }> {
  const deadline = Date.now() + FISCAL_CLEAR_WAIT_MS;
  while (Date.now() < deadline) {
    const { data, error } = await admin
      .from('fiscal_clear_jobs')
      .select('status, error_code, error_message')
      .eq('id', jobId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (error) {
      return { ok: false, error: 'fiscal_clear_failed', detail: error.message };
    }
    if (data?.status === 'succeeded') return { ok: true };
    if (data?.status === 'failed' || data?.status === 'expired') {
      return {
        ok: false,
        error: 'fiscal_clear_failed',
        detail: data.error_message || data.error_code || data.status,
      };
    }
    await new Promise((r) => setTimeout(r, FISCAL_CLEAR_POLL_MS));
  }
  return { ok: false, error: 'fiscal_clear_timeout' };
}

/**
 * Sole owner pre-delivery wipe for one restaurant:
 * 1) If an active print Agent is paired and fiscal traces exist → hang-queue fiscal wipe + wait ack
 * 2) RPC clears Mesa runtime/test business rows (keeps menu/tables/staff/print setup)
 */
export async function clearRestaurantBusinessData(params: {
  admin: SupabaseClient;
  restaurantId: string;
  actorUserId: string;
}): Promise<ClearRestaurantBusinessDataResult> {
  const { admin, restaurantId, actorUserId } = params;

  let fiscalStatus: 'cleared' | 'skipped_no_agent' = 'skipped_no_agent';

  try {
    const hasAgent = await restaurantHasActiveAgent(admin, restaurantId);

    if (hasAgent) {
      const now = Date.now();
      const { data: job, error: enqueueErr } = await admin
        .from('fiscal_clear_jobs')
        .insert({
          restaurant_id: restaurantId,
          status: 'pending',
          created_by: actorUserId,
          expires_at: new Date(now + FISCAL_CLEAR_JOB_TTL_MS).toISOString(),
          created_at: new Date(now).toISOString(),
          updated_at: new Date(now).toISOString(),
        })
        .select('id')
        .single();

      if (enqueueErr || !job?.id) {
        return {
          ok: false,
          error: 'fiscal_clear_enqueue_failed',
          detail: enqueueErr?.message,
        };
      }

      const waited = await waitFiscalClearJob(admin, restaurantId, job.id);
      if (!waited.ok) {
        return {
          ok: false,
          error: waited.error,
          detail: waited.detail,
        };
      }
      fiscalStatus = 'cleared';
    }

    const { error: rpcError } = await admin.rpc('clear_restaurant_business_data', {
      p_restaurant_id: restaurantId,
    });
    if (rpcError) {
      return { ok: false, error: 'clear_failed', detail: rpcError.message };
    }

    return { ok: true, restaurantId, fiscal: fiscalStatus };
  } catch (e) {
    return {
      ok: false,
      error: 'clear_failed',
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}
