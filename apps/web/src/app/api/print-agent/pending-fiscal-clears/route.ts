import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyActiveAgentBearer } from '@/lib/print-agent-auth';

export const runtime = 'nodejs';

/** Agent: claim pending fiscal test-data wipe jobs. */
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

  const nowIso = new Date().toISOString();

  await admin
    .from('fiscal_clear_jobs')
    .update({
      status: 'expired',
      error_code: 'ttl_expired',
      error_message: 'fiscal clear job expired before claim',
      updated_at: nowIso,
    })
    .eq('restaurant_id', ctx.restaurant_id)
    .eq('status', 'pending')
    .lt('expires_at', nowIso);

  const { data: rows, error } = await admin
    .from('fiscal_clear_jobs')
    .select('id, restaurant_id, status, created_at, expires_at')
    .eq('restaurant_id', ctx.restaurant_id)
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  const claimed = [];
  for (const job of rows ?? []) {
    const { data: updated, error: claimErr } = await admin
      .from('fiscal_clear_jobs')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('restaurant_id', ctx.restaurant_id)
      .eq('status', 'pending')
      .select('id, restaurant_id, status, created_at, expires_at')
      .maybeSingle();

    if (claimErr || !updated) continue;
    claimed.push(updated);
  }

  return NextResponse.json({ jobs: claimed });
}
