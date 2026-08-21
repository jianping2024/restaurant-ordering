import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyActiveAgentBearer } from '@/lib/print-agent-auth';

export const runtime = 'nodejs';

/**
 * Agent ack after local temp-table + catalog upsert (bill-sync-contract-v1.0).
 * Must only be called after durable local persist succeeded.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  let body: {
    status?: unknown;
    error_code?: unknown;
    error_message?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const status = body.status === 'succeeded' || body.status === 'failed' ? body.status : null;
  if (!status) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const errorCode =
    typeof body.error_code === 'string' && body.error_code.trim()
      ? body.error_code.trim().slice(0, 64)
      : null;
  const errorMessage =
    typeof body.error_message === 'string' && body.error_message.trim()
      ? body.error_message.trim().slice(0, 500)
      : null;

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

  const { data: row, error: loadErr } = await admin
    .from('bill_sync_jobs')
    .select('id, restaurant_id, status')
    .eq('id', id)
    .eq('restaurant_id', ctx.restaurant_id)
    .maybeSingle();

  if (loadErr || !row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (row.status === 'succeeded' || row.status === 'failed') {
    return NextResponse.json({ ok: true, job: row, idempotent: true });
  }

  const { data: updated, error: updErr } = await admin
    .from('bill_sync_jobs')
    .update({
      status,
      error_code: status === 'failed' ? errorCode : null,
      error_message: status === 'failed' ? errorMessage : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('restaurant_id', ctx.restaurant_id)
    .in('status', ['pending', 'processing'])
    .select('id, status, error_code, error_message')
    .maybeSingle();

  if (updErr) {
    return NextResponse.json({ error: 'update_failed', message: updErr.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: 'conflict' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, job: updated });
}
