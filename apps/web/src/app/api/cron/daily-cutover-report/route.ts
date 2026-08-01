import { NextResponse } from 'next/server';
import { runSealAndReportForRestaurant } from '@/lib/analytics/run-seal-and-report';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyCronSecret } from '@/lib/verify-cron-secret';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * On-prem daily cutover phase 2 (seal yesterday + optional 经营日报 upload).
 * Not registered in Vercel crons — local systemd timer only.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'cron_secret_not_configured' }, { status: 500 });
  }
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from('restaurants')
    .select('id')
    .eq('deployment_mode', 'on_prem');

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const restaurants = rows || [];
  if (restaurants.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'no_on_prem_restaurants' });
  }

  const results = [];
  for (const row of restaurants) {
    results.push(await runSealAndReportForRestaurant(admin, row.id as string));
  }

  return NextResponse.json({ ok: true, results });
}
