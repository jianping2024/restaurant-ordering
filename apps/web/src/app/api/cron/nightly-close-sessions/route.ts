import { NextResponse } from 'next/server';
import {
  type NightlyAutoClosePolicy,
  shouldRunNightlyAutoClose,
} from '@/lib/auto-close-active-sessions';
import { expireStalePrintJobs } from '@/lib/expire-stale-print-jobs';
import { purgeExpiredOperationLogs } from '@/lib/operation-logs/purge-expired-operation-logs';
import { executeNightlyAutoClose } from '@/lib/run-nightly-auto-close';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyCronSecret } from '@/lib/verify-cron-secret';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parsePolicy(req: Request): NightlyAutoClosePolicy | null {
  const raw = new URL(req.url).searchParams.get('policy');
  if (raw == null || raw === '') return 'due';
  if (raw === 'due' || raw === 'always') return raw;
  return null;
}

/**
 * Vercel Cron (04:00 + 05:00 UTC): default policy=due (Lisbon hour === 5, DST-safe).
 * On-prem daily-cutover: policy=always (systemd / manual start already owns the schedule).
 * Auth: CRON_SECRET for both.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'cron_secret_not_configured' }, { status: 500 });
  }
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const policy = parsePolicy(req);
  if (!policy) {
    return NextResponse.json({ ok: false, error: 'invalid_policy' }, { status: 400 });
  }

  let purgedOperationLogs = 0;
  try {
    const admin = createAdminClient();
    const { deletedCount, error: purgeError } = await purgeExpiredOperationLogs(admin);
    if (purgeError) {
      console.error('[mesa nightly-auto-close] purge expired operation logs failed:', purgeError);
    } else {
      purgedOperationLogs = deletedCount;
    }
  } catch (e) {
    console.error('[mesa nightly-auto-close] purge expired operation logs failed:', e);
  }

  if (!shouldRunNightlyAutoClose({ policy })) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'not_due',
      policy,
      purgedOperationLogs,
    });
  }

  try {
    const admin = createAdminClient();
    const { expiredCount, error: expireError } = await expireStalePrintJobs(admin);
    if (expireError) {
      console.error('[mesa nightly-auto-close] expire stale print jobs failed:', expireError);
    }

    const { closedCount, dateKey } = await executeNightlyAutoClose();
    const expiredPrintJobs = expireError ? 0 : expiredCount;
    console.info('[mesa nightly-auto-close] cron:', {
      closedCount,
      dateKey,
      expiredPrintJobs,
      purgedOperationLogs,
      policy,
    });
    return NextResponse.json({
      ok: true,
      closedCount,
      dateKey,
      expiredPrintJobs,
      purgedOperationLogs,
      policy,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error';
    console.error('[mesa nightly-auto-close] cron failed:', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
