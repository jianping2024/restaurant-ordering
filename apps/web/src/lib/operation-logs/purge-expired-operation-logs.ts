import type { SupabaseClient } from '@supabase/supabase-js';
import { operationLogRetentionCutoffUtcIso } from '@/lib/operation-logs/date-range';

/** Delete operation_logs rows older than the 7-day retention window. */
export async function purgeExpiredOperationLogs(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<{ deletedCount: number; error: string | null }> {
  const cutoffUtc = operationLogRetentionCutoffUtcIso(now);
  const { data, error } = await admin
    .from('operation_logs')
    .delete()
    .lt('created_at', cutoffUtc)
    .select('id');

  if (error) {
    return { deletedCount: 0, error: error.message };
  }
  return { deletedCount: data?.length ?? 0, error: null };
}
