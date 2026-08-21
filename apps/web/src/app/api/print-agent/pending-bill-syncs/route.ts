import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyActiveAgentBearer } from '@/lib/print-agent-auth';

export const runtime = 'nodejs';

/** Agent: claim pending bill-sync jobs (same agentjwt as print pending-jobs). */
export async function GET(req: Request) {
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

  const { data: rows, error } = await admin
    .from('bill_sync_jobs')
    .select(
      'id, restaurant_id, request_id, source_sale_id, table_display_name, scope_type, payload, status, created_at',
    )
    .eq('restaurant_id', ctx.restaurant_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  const claimed = [];
  for (const job of rows ?? []) {
    const { data: updated, error: claimErr } = await admin
      .from('bill_sync_jobs')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('restaurant_id', ctx.restaurant_id)
      .eq('status', 'pending')
      .select(
        'id, restaurant_id, request_id, source_sale_id, table_display_name, scope_type, payload, status, created_at',
      )
      .maybeSingle();

    if (claimErr || !updated) continue;
    claimed.push(updated);
  }

  return NextResponse.json({ jobs: claimed });
}
