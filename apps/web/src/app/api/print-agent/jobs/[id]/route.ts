import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyActiveAgentBearer } from '@/lib/print-agent-auth';
import {
  isPrintJobVisibleToDevice,
  loadDeviceRoutingStationIds,
} from '@/lib/print-agent-routing';
import type { PrintJobStatus } from '@/types';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const jobId = params.id;
  if (!jobId) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  let body: { status?: unknown; error_message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const status = typeof body.status === 'string' ? body.status : '';
  const errMsg =
    typeof body.error_message === 'string' ? body.error_message.slice(0, 2000) : null;

  if (status !== 'processing' && status !== 'done' && status !== 'failed') {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  if (status === 'failed' && !errMsg) {
    return NextResponse.json({ error: 'error_message_required' }, { status: 400 });
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

  const { data: job, error: jErr } = await admin
    .from('print_jobs')
    .select('id, restaurant_id, status, attempts, claimed_by, type, payload')
    .eq('id', jobId)
    .maybeSingle();

  if (jErr || !job) {
    return NextResponse.json({ error: 'job_not_found' }, { status: 404 });
  }
  if (job.restaurant_id !== ctx.restaurant_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const deviceStationIds = await loadDeviceRoutingStationIds(
    admin,
    ctx.device_id,
    ctx.restaurant_id,
  );
  if (!isPrintJobVisibleToDevice(job, deviceStationIds)) {
    return NextResponse.json({ error: 'job_not_routable_to_device' }, { status: 403 });
  }

  const current = job.status as PrintJobStatus;

  if (status === 'processing') {
    if (current !== 'pending') {
      return NextResponse.json({ error: 'invalid_transition' }, { status: 409 });
    }
    const nextAttempts = (typeof job.attempts === 'number' ? job.attempts : 0) + 1;
    const { data: updated, error: uErr } = await admin
      .from('print_jobs')
      .update({
        status: 'processing',
        claimed_by: ctx.device_id,
        attempts: nextAttempts,
      })
      .eq('id', jobId)
      .eq('status', 'pending')
      .select('id, status')
      .maybeSingle();

    if (uErr || !updated) {
      return NextResponse.json({ error: 'optimistic_lock_failed' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, job: updated });
  }

  if (status === 'done') {
    if (current !== 'processing') {
      return NextResponse.json({ error: 'invalid_transition' }, { status: 409 });
    }
    const { data: updated, error: uErr } = await admin
      .from('print_jobs')
      .update({ status: 'done', error_message: null })
      .eq('id', jobId)
      .eq('status', 'processing')
      .eq('claimed_by', ctx.device_id)
      .select('id, status')
      .maybeSingle();

    if (uErr || !updated) {
      return NextResponse.json({ error: 'optimistic_lock_failed' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, job: updated });
  }

  // failed (from processing after print error, or from pending when routing/config fails)
  if (current !== 'processing' && current !== 'pending') {
    return NextResponse.json({ error: 'invalid_transition' }, { status: 409 });
  }
  let updateQuery = admin
    .from('print_jobs')
    .update({
      status: 'failed',
      error_message: errMsg,
      ...(current === 'pending' ? { claimed_by: ctx.device_id } : {}),
    })
    .eq('id', jobId)
    .eq('status', current);

  if (current === 'processing') {
    updateQuery = updateQuery.eq('claimed_by', ctx.device_id);
  }

  const { data: updated, error: uErr } = await updateQuery.select('id, status').maybeSingle();

  if (uErr || !updated) {
    return NextResponse.json({ error: 'optimistic_lock_failed' }, { status: 409 });
  }
  return NextResponse.json({ ok: true, job: updated });
}
