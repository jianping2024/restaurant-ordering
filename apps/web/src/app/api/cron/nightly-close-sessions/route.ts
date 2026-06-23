import { NextResponse } from 'next/server';
import { isNightlyAutoCloseDue } from '@/lib/auto-close-active-sessions';
import { executeNightlyAutoClose } from '@/lib/run-nightly-auto-close';
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
    const { closedCount, dateKey } = await executeNightlyAutoClose();
    console.info('[mesa nightly-auto-close] cron closed sessions:', closedCount, dateKey);
    return NextResponse.json({ ok: true, closedCount, dateKey });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error';
    console.error('[mesa nightly-auto-close] cron failed:', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
