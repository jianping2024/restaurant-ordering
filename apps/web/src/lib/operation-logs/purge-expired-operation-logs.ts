import type { SupabaseClient } from '@supabase/supabase-js';
import { operationLogRetentionCutoffUtcIso } from '@/lib/operation-logs/date-range';
import { resolveOperationLogRetentionDays } from '@/lib/operation-logs/retention-days';

/** Delete operation_logs rows older than each restaurant's configured retention window. */
export async function purgeExpiredOperationLogs(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<{ deletedCount: number; error: string | null }> {
  const { data: restaurants, error: readError } = await admin
    .from('restaurants')
    .select('id, operation_log_retention_days');

  if (readError) {
    return { deletedCount: 0, error: readError.message };
  }

  let deletedCount = 0;
  for (const restaurant of restaurants ?? []) {
    const retentionDays = resolveOperationLogRetentionDays(restaurant.operation_log_retention_days);
    const cutoffUtc = operationLogRetentionCutoffUtcIso(now, retentionDays);
    const { data, error } = await admin
      .from('operation_logs')
      .delete()
      .eq('restaurant_id', restaurant.id)
      .lt('created_at', cutoffUtc)
      .select('id');

    if (error) {
      return { deletedCount, error: error.message };
    }
    deletedCount += data?.length ?? 0;
  }

  return { deletedCount, error: null };
}
