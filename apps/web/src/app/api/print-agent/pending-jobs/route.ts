import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyActiveAgentBearer } from '@/lib/print-agent-auth';
import { printJobMaxAgeCutoffIso } from '@/lib/print-job-max-age';
import {
  filterPrintJobsByRestaurant,
  rejectForbiddenPrintJobsScopeParams,
  rejectUnexpectedPrintJobsQueryParams,
} from '@/lib/print-jobs-scope';

export const runtime = 'nodejs';

/** Agent: pending jobs for JWT restaurant only (created within 10 minutes). Stale expiry runs on cron. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const forbiddenScope = rejectForbiddenPrintJobsScopeParams(searchParams);
  if (forbiddenScope) {
    return NextResponse.json(
      { error: 'scope_param_forbidden', param: forbiddenScope },
      { status: 400 },
    );
  }

  const unexpected = rejectUnexpectedPrintJobsQueryParams(searchParams, []);
  if (unexpected) {
    return NextResponse.json({ error: 'unexpected_query_param', param: unexpected }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const ctx = await verifyActiveAgentBearer(req, admin);
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const cutoff = printJobMaxAgeCutoffIso();
  const { data: rows, error } = await admin
    .from('print_jobs')
    .select('id, restaurant_id, type, payload, status, created_at, attempts, error_message')
    .eq('restaurant_id', ctx.restaurant_id)
    .eq('status', 'pending')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  const jobs = filterPrintJobsByRestaurant(rows, ctx.restaurant_id);
  return NextResponse.json({ jobs });
}
