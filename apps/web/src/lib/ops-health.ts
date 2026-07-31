import { createAdminClient } from '@/lib/supabase/admin';

/** Ops probe statuses — only these two exist under `/api/health/*`. */
export type OpsHealthStatus = 'live' | 'ready';

export type OpsHealthOkBody = { ok: true; status: OpsHealthStatus };

export type OpsHealthFailBody = {
  ok: false;
  status: 'ready';
  error: string;
};

/** Process is up and can answer HTTP. No dependency checks. */
export function liveHealthBody(): OpsHealthOkBody {
  return { ok: true, status: 'live' };
}

/**
 * Ready to serve product traffic: configured Supabase is reachable.
 * Lightweight read only — not a business read-model refresh.
 */
export async function checkReadyHealth(): Promise<
  { httpStatus: 200; body: OpsHealthOkBody } | { httpStatus: 503; body: OpsHealthFailBody }
> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('restaurants').select('id').limit(1);
    if (error) {
      return {
        httpStatus: 503,
        body: { ok: false, status: 'ready', error: error.message || 'supabase_query_failed' },
      };
    }
    return { httpStatus: 200, body: { ok: true, status: 'ready' } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'supabase_unreachable';
    return {
      httpStatus: 503,
      body: { ok: false, status: 'ready', error: message },
    };
  }
}
