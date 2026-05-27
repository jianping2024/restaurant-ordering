import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PRINT_JOB_EXPIRED_ERROR_MESSAGE,
  printJobMaxAgeCutoffIso,
} from '@/lib/print-job-max-age';

/** Mark overdue pending/processing jobs failed so the agent will not print them. */
export async function expireStalePrintJobs(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ expiredCount: number; error: string | null }> {
  const cutoff = printJobMaxAgeCutoffIso();
  const { data, error } = await admin
    .from('print_jobs')
    .update({
      status: 'failed',
      error_message: PRINT_JOB_EXPIRED_ERROR_MESSAGE,
    })
    .eq('restaurant_id', restaurantId)
    .in('status', ['pending', 'processing'])
    .lt('created_at', cutoff)
    .select('id');

  if (error) {
    return { expiredCount: 0, error: error.message };
  }
  return { expiredCount: data?.length ?? 0, error: null };
}
