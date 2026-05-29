import type { SupabaseClient } from '@supabase/supabase-js';
import { getZonedCalendarParts } from '@/lib/zoned-time';
import { closeActiveTableSessionWithOperationalCleanup } from '@/lib/close-active-table-session-with-cleanup';

/** Nightly auto-close: 05:00 in this zone (local scheduler checks hourly while app is running). */
export const NIGHTLY_AUTO_CLOSE_TIMEZONE = 'Europe/Lisbon';
export const NIGHTLY_AUTO_CLOSE_HOUR = 5;

export function isNightlyAutoCloseDue(now = new Date()): boolean {
  const { hour } = getZonedCalendarParts(now, NIGHTLY_AUTO_CLOSE_TIMEZONE);
  return hour === NIGHTLY_AUTO_CLOSE_HOUR;
}

/**
 * Nightly cutover: same operational close as waiter/owner (cancel unpaid splits, void lines, close session).
 * Does NOT use closeTableSessionWithCheckoutGuard — intentionally bypasses checkout confirm (05:00 Lisbon).
 * Processes each open/billing table row once.
 */
export async function closeAllOpenBillingSessions(admin: SupabaseClient): Promise<{ closedCount: number }> {
  const { data: rows, error } = await admin
    .from('table_sessions')
    .select('restaurant_id, table_id')
    .in('status', ['open', 'billing']);

  if (error) throw error;
  let closedCount = 0;
  for (const row of rows || []) {
    const rid = row.restaurant_id as string;
    const tid = row.table_id as string;
    const result = await closeActiveTableSessionWithOperationalCleanup(admin, rid, tid, 'auto_nightly');
    if (result.ok) closedCount += 1;
  }
  return { closedCount };
}
