import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { expireStalePrintJobs } from '@/lib/expire-stale-print-jobs';
import { verifyCronSecret } from '@/lib/verify-cron-secret';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Vercel Cron (every 5 min) — fail pending/processing print jobs older than 10 minutes. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'cron_secret_not_configured' }, { status: 500 });
  }
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_misconfigured' }, { status: 503 });
  }

  const { expiredCount, error } = await expireStalePrintJobs(admin);
  if (error) {
    console.error('[mesa expire-stale-print-jobs] cron failed:', error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  if (expiredCount > 0) {
    console.info('[mesa expire-stale-print-jobs] cron expired jobs:', expiredCount);
  }

  return NextResponse.json({ ok: true, expiredCount });
}
