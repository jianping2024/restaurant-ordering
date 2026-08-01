import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireSettingsRestaurantAuth } from '@/lib/settings-restaurant-auth';
import {
  rejectForbiddenPrintJobsScopeParams,
  rejectUnexpectedPrintJobsQueryParams,
} from '@/lib/print-jobs-scope';
import { PRINT_JOBS_RECENT_LIMIT, queryRecentPrintJobs } from '@/lib/print-jobs-recent';

export const runtime = 'nodejs';

/** Dashboard: newest print_jobs for the logged-in owner's restaurant (fixed top-N, no paging). */
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

  const auth = await requireSettingsRestaurantAuth('settings.print_assistant.manage');
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const { jobs, errorMessage } = await queryRecentPrintJobs(supabase, auth.restaurantId);

  if (errorMessage) {
    return NextResponse.json({ error: 'query_failed', message: errorMessage }, { status: 500 });
  }

  return NextResponse.json({
    jobs,
    limit: PRINT_JOBS_RECENT_LIMIT,
  });
}
