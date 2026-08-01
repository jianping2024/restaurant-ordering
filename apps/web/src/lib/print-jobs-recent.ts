import type { SupabaseClient } from '@supabase/supabase-js';
import type { PrintJobSummary } from '@/types';

/** Dashboard recent queue: one limit for SSR, API, and UI. */
export const PRINT_JOBS_RECENT_LIMIT = 5;

export const PRINT_JOBS_RECENT_COLUMNS =
  'id, type, status, created_at, error_message, table_display, table_id' as const;

/** Newest print_jobs for one restaurant, capped at PRINT_JOBS_RECENT_LIMIT. */
export async function queryRecentPrintJobs(
  client: SupabaseClient,
  restaurantId: string,
): Promise<{ jobs: PrintJobSummary[]; errorMessage: string | null }> {
  const { data, error } = await client
    .from('print_jobs')
    .select(PRINT_JOBS_RECENT_COLUMNS)
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(PRINT_JOBS_RECENT_LIMIT);

  if (error) {
    return { jobs: [], errorMessage: error.message };
  }
  return { jobs: (data || []) as PrintJobSummary[], errorMessage: null };
}
