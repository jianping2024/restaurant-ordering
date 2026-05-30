import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PRINT_JOB_EXPIRED_ERROR_MESSAGE,
  PRINT_JOB_PROCESSING_STALE_ERROR_MESSAGE,
  printJobMaxAgeCutoffIso,
  printJobProcessingStaleCutoffIso,
} from '@/lib/print-job-max-age';

export type ExpireStalePrintJobsResult = {
  expiredCount: number;
  processingStaleCount: number;
  error: string | null;
};

/** Mark overdue pending/processing jobs failed so the agent will not print them. */
export async function expireStalePrintJobs(
  admin: SupabaseClient,
  restaurantId: string,
  now: Date = new Date(),
): Promise<ExpireStalePrintJobsResult> {
  const ageCutoff = printJobMaxAgeCutoffIso(now);
  const { data: agedRows, error: ageErr } = await admin
    .from('print_jobs')
    .update({
      status: 'failed',
      error_message: PRINT_JOB_EXPIRED_ERROR_MESSAGE,
    })
    .eq('restaurant_id', restaurantId)
    .in('status', ['pending', 'processing'])
    .lt('created_at', ageCutoff)
    .select('id');

  if (ageErr) {
    return { expiredCount: 0, processingStaleCount: 0, error: ageErr.message };
  }

  const processingCutoff = printJobProcessingStaleCutoffIso(now);
  const { data: staleRows, error: staleErr } = await admin
    .from('print_jobs')
    .update({
      status: 'failed',
      error_message: PRINT_JOB_PROCESSING_STALE_ERROR_MESSAGE,
    })
    .eq('restaurant_id', restaurantId)
    .eq('status', 'processing')
    .lt('updated_at', processingCutoff)
    .select('id');

  if (staleErr) {
    return {
      expiredCount: agedRows?.length ?? 0,
      processingStaleCount: 0,
      error: staleErr.message,
    };
  }

  return {
    expiredCount: agedRows?.length ?? 0,
    processingStaleCount: staleRows?.length ?? 0,
    error: null,
  };
}
