import { createAdminClient } from '@/lib/supabase/admin';
import {
  closeAllOpenBillingSessions,
  NIGHTLY_AUTO_CLOSE_TIMEZONE,
} from '@/lib/auto-close-active-sessions';
import { getZonedCalendarParts } from '@/lib/zoned-time';

export async function executeNightlyAutoClose(): Promise<{ closedCount: number; dateKey: string }> {
  const admin = createAdminClient();
  const { closedCount } = await closeAllOpenBillingSessions(admin);
  const { dateKey } = getZonedCalendarParts(new Date(), NIGHTLY_AUTO_CLOSE_TIMEZONE);
  return { closedCount, dateKey };
}
