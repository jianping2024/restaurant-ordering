import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PRINT_JOB_EXPIRED_ERROR_MESSAGE,
  printJobMaxAgeCutoffIso,
} from '@/lib/print-job-max-age';

const EXPIRE_COOLDOWN_MS = 5 * 60 * 1000;

let lastExpireStalePrintJobsAtMs = 0;

/** Mark overdue pending/processing jobs failed so the agent will not print them. */
export async function expireStalePrintJobs(
  admin: SupabaseClient,
): Promise<{ expiredCount: number; error: string | null }> {
  const cutoff = printJobMaxAgeCutoffIso();
  const { data, error } = await admin
    .from('print_jobs')
    .update({
      status: 'failed',
      error_message: PRINT_JOB_EXPIRED_ERROR_MESSAGE,
    })
    .in('status', ['pending', 'processing'])
    .lt('created_at', cutoff)
    .select('id');

  if (error) {
    return { expiredCount: 0, error: error.message };
  }
  return { expiredCount: data?.length ?? 0, error: null };
}

/** Throttled expire for high-frequency poll routes (at most once per cooldown per warm instance). */
export async function maybeExpireStalePrintJobs(
  admin: SupabaseClient,
  nowMs: number = Date.now(),
): Promise<{ expiredCount: number; error: string | null; skipped?: boolean }> {
  if (nowMs - lastExpireStalePrintJobsAtMs < EXPIRE_COOLDOWN_MS) {
    return { expiredCount: 0, error: null, skipped: true };
  }
  lastExpireStalePrintJobsAtMs = nowMs;
  return expireStalePrintJobs(admin);
}
