import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOwnerRestaurantId } from '@/lib/print-agent-dashboard-auth';
import {
  rejectForbiddenPrintJobsScopeParams,
  rejectUnexpectedPrintJobsQueryParams,
} from '@/lib/print-jobs-scope';
import type { PrintJobSummary } from '@/types';

export const runtime = 'nodejs';

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

  const unexpected = rejectUnexpectedPrintJobsQueryParams(searchParams, ['limit']);
  if (unexpected) {
    return NextResponse.json({ error: 'unexpected_query_param', param: unexpected }, { status: 400 });
  }

  const auth = await getOwnerRestaurantId();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit')) || 5));

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('print_jobs')
    .select('id, type, status, created_at, error_message, table_display, table_id')
    .eq('restaurant_id', auth.restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  const jobs = (rows || []) as PrintJobSummary[];

  return NextResponse.json({ jobs });
}
