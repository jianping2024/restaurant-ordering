import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { expireStalePrintJobs } from '@/lib/expire-stale-print-jobs';
import { getOwnerRestaurantId } from '@/lib/print-agent-dashboard-auth';
import {
  rejectForbiddenPrintJobsScopeParams,
  rejectUnexpectedPrintJobsQueryParams,
} from '@/lib/print-jobs-scope';
import type { PrintJobStatus, PrintJobSummary } from '@/types';

export const runtime = 'nodejs';

const PAGE_SIZE = 10;

function parsePage(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function parseStatus(raw: string | null): PrintJobStatus | 'invalid' | null {
  if (!raw) return null;
  if (raw === 'pending' || raw === 'processing' || raw === 'done' || raw === 'failed') return raw;
  return 'invalid';
}

/** Dashboard: recent print_jobs for the logged-in owner's restaurant only (no restaurant_id param). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const forbiddenScope = rejectForbiddenPrintJobsScopeParams(searchParams);
  if (forbiddenScope) {
    return NextResponse.json(
      { error: 'scope_param_forbidden', param: forbiddenScope },
      { status: 400 },
    );
  }

  const unexpected = rejectUnexpectedPrintJobsQueryParams(searchParams, ['page', 'status']);
  if (unexpected) {
    return NextResponse.json({ error: 'unexpected_query_param', param: unexpected }, { status: 400 });
  }

  const auth = await getOwnerRestaurantId();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const admin = createAdminClient();
    const { error: expireErr } = await expireStalePrintJobs(admin, auth.restaurantId);
    if (expireErr) {
      return NextResponse.json({ error: 'expire_stale_failed', message: expireErr }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const page = parsePage(searchParams.get('page'));
  const status = parseStatus(searchParams.get('status'));
  if (status === 'invalid') {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  let query = supabase
    .from('print_jobs')
    .select('id, type, status, created_at, error_message, table_display, table_id', { count: 'exact' })
    .eq('restaurant_id', auth.restaurantId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data: rows, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  const jobs = (rows || []) as PrintJobSummary[];
  const total = count || 0;

  return NextResponse.json({
    jobs,
    page,
    pageSize: PAGE_SIZE,
    status: status || 'all',
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
