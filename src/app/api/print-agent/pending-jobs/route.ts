import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAgentBearer } from '@/lib/print-agent-auth';
import {
  filterPrintJobsByRestaurant,
  rejectForbiddenPrintJobsScopeParams,
  rejectUnexpectedPrintJobsQueryParams,
} from '@/lib/print-jobs-scope';

export const runtime = 'nodejs';

/** Agent: pending jobs for JWT restaurant only. No query params (no cross-tenant scope). */
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

  const ctx = verifyAgentBearer(req);
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: rows, error } = await admin
    .from('print_jobs')
    .select('id, restaurant_id, type, payload, status, created_at, attempts, error_message')
    .eq('restaurant_id', ctx.restaurant_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  const jobs = filterPrintJobsByRestaurant(rows, ctx.restaurant_id);
  return NextResponse.json({ jobs });
}
