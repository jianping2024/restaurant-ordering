import { NextResponse } from 'next/server';
import { isNightlyAutoCloseDue } from '@/lib/auto-close-active-sessions';
import { expireStalePrintJobs } from '@/lib/expire-stale-print-jobs';
import { executeNightlyAutoClose } from '@/lib/run-nightly-auto-close';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyCronSecret } from '@/lib/verify-cron-secret';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron (04:00 + 05:00 UTC) — gated by Europe/Lisbon hour === 5 for DST safety.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'cron_secret_not_configured' }, { status: 500 });
  }
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (!isNightlyAutoCloseDue()) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not_due' });
  }

  try {
    const admin = createAdminClient();
    const { expiredCount, error: expireError } = await expireStalePrintJobs(admin);
    if (expireError) {
      console.error('[mesa nightly-auto-close] expire stale print jobs failed:', expireError);
    }

    const { closedCount, dateKey } = await executeNightlyAutoClose();
    const expiredPrintJobs = expireError ? 0 : expiredCount;
    console.info('[mesa nightly-auto-close] cron:', { closedCount, dateKey, expiredPrintJobs });
    return NextResponse.json({ ok: true, closedCount, dateKey, expiredPrintJobs });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error';
    console.error('[mesa nightly-auto-close] cron failed:', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
