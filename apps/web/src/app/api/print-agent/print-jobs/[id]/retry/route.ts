import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOwnerRestaurantId } from '@/lib/print-agent-dashboard-auth';

export const runtime = 'nodejs';

/** Dashboard: re-queue a failed print job (fresh created_at so agent max-age / offline-backlog rules apply to this retry). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await getOwnerRestaurantId({ requireWritable: true });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const jobId = params.id?.trim();
  if (!jobId) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: job, error: jErr } = await admin
    .from('print_jobs')
    .select('id, restaurant_id, status')
    .eq('id', jobId)
    .maybeSingle();

  if (jErr || !job) {
    return NextResponse.json({ error: 'job_not_found' }, { status: 404 });
  }
  if (job.restaurant_id !== auth.restaurantId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (job.status !== 'failed') {
    return NextResponse.json({ error: 'not_failed' }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: uErr } = await admin
    .from('print_jobs')
    .update({
      status: 'pending',
      created_at: nowIso,
      error_message: null,
      claimed_by: null,
    })
    .eq('id', jobId)
    .eq('status', 'failed')
    .select('id, status')
    .maybeSingle();

  if (uErr || !updated) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, job: updated });
}
