import { createAdminClient } from '@/lib/supabase/admin';
import {
  closeAllOpenBillingSessions,
  isNightlyAutoCloseDue,
  NIGHTLY_AUTO_CLOSE_TIMEZONE,
} from '@/lib/auto-close-active-sessions';
import { getZonedCalendarParts } from '@/lib/zoned-time';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let lastRunDateKey: string | null = null;
let started = false;

async function runNightlyAutoCloseIfDue() {
  if (!isNightlyAutoCloseDue()) return;

  const { dateKey } = getZonedCalendarParts(new Date(), NIGHTLY_AUTO_CLOSE_TIMEZONE);
  if (lastRunDateKey === dateKey) return;
  lastRunDateKey = dateKey;

  try {
    const admin = createAdminClient();
    const { closedCount } = await closeAllOpenBillingSessions(admin);
    console.info('[mesa nightly-auto-close] closed sessions:', closedCount, dateKey);
  } catch (e) {
    console.error('[mesa nightly-auto-close] failed:', e);
    lastRunDateKey = null;
  }
}

/** Runs inside the Node process for `next dev` / `next start` (not serverless cron). */
export function startNightlyAutoCloseScheduler() {
  if (started || typeof setInterval === 'undefined') return;
  started = true;

  void runNightlyAutoCloseIfDue();
  setInterval(() => void runNightlyAutoCloseIfDue(), CHECK_INTERVAL_MS);
}
