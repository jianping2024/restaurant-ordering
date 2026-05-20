import type { SupabaseClient } from '@supabase/supabase-js';
import { getZonedCalendarParts } from '@/lib/zoned-time';

/** Nightly auto-close: 05:00 in this zone (local scheduler checks hourly while app is running). */
export const NIGHTLY_AUTO_CLOSE_TIMEZONE = 'Europe/Lisbon';
export const NIGHTLY_AUTO_CLOSE_HOUR = 5;

export function isNightlyAutoCloseDue(now = new Date()): boolean {
  const { hour } = getZonedCalendarParts(now, NIGHTLY_AUTO_CLOSE_TIMEZONE);
  return hour === NIGHTLY_AUTO_CLOSE_HOUR;
}

/** Marks every open/billing table session closed (nightly cutover). Idempotent on repeat. */
export async function closeAllOpenBillingSessions(
  admin: SupabaseClient,
  closedReason: string = 'auto_nightly',
): Promise<{ closedCount: number }> {
  const { data, error } = await admin
    .from('table_sessions')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_reason: closedReason,
    })
    .in('status', ['open', 'billing'])
    .select('id');

  if (error) throw error;
  return { closedCount: data?.length ?? 0 };
}
