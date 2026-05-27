import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PRINT_AGENT_CONNECTION_TEST_ORDER_ID } from '@/lib/print-agent-constants';
import { signPrintAgentJwt } from '@/lib/print-agent-jwt';
import {
  claimRateLimitCheck,
  claimRecordFailure,
  claimRecordSuccess,
} from '@/lib/print-agent-claim-rate-limit';
import { isUuid } from '@/lib/print-agent-auth';
import { clientIpFromRequest } from '@/lib/request-client-ip';
import { PRINT_AGENT_CREDENTIAL_TTL_SEC } from '@/lib/print-agent-credential';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const rl = claimRateLimitCheck(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  const jwtSecret = process.env.PRINT_AGENT_JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 16) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  let body: { code?: unknown; device_id?: unknown; label?: unknown };
  try {
    body = await req.json();
  } catch {
    claimRecordFailure(ip);
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const deviceId = typeof body.device_id === 'string' ? body.device_id.trim() : '';
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 120) : '';

  if (!/^[0-9]{6}$/.test(code) || !isUuid(deviceId)) {
    claimRecordFailure(ip);
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const nowIso = new Date().toISOString();

  const { data: pairing, error: pErr } = await admin
    .from('print_agent_pairings')
    .select('id, restaurant_id, expires_at, consumed_at')
    .eq('code', code)
    .is('consumed_at', null)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .limit(2);

  if (pErr) {
    claimRecordFailure(ip);
    return NextResponse.json({ error: 'query_failed', message: pErr.message }, { status: 500 });
  }

  const rows = pairing || [];
  if (rows.length === 0) {
    claimRecordFailure(ip);
    return NextResponse.json({ error: 'invalid_or_expired_code' }, { status: 404 });
  }
  if (rows.length > 1) {
    claimRecordFailure(ip);
    return NextResponse.json({ error: 'ambiguous_code' }, { status: 409 });
  }

  const p = rows[0];

  const { data: existingDev } = await admin
    .from('print_agent_devices')
    .select('id, restaurant_id')
    .eq('id', deviceId)
    .maybeSingle();

  if (existingDev && existingDev.restaurant_id !== p.restaurant_id) {
    claimRecordFailure(ip);
    return NextResponse.json({ error: 'device_id_conflict' }, { status: 409 });
  }

  const { data: upd, error: uErr } = await admin
    .from('print_agent_pairings')
    .update({ consumed_at: nowIso })
    .eq('id', p.id)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();

  if (uErr || !upd) {
    claimRecordFailure(ip);
    return NextResponse.json({ error: 'code_already_used' }, { status: 409 });
  }

  const validUntil = new Date(Date.now() + PRINT_AGENT_CREDENTIAL_TTL_SEC * 1000).toISOString();

  const { error: devErr } = await admin.from('print_agent_devices').upsert(
    {
      id: deviceId,
      restaurant_id: p.restaurant_id,
      pairing_id: p.id,
      label: label || null,
      valid_until: validUntil,
      revoked_at: null,
      last_seen: nowIso,
    },
    { onConflict: 'id' },
  );

  if (devErr) {
    await admin.from('print_agent_pairings').update({ consumed_at: null }).eq('id', p.id);
    claimRecordFailure(ip);
    return NextResponse.json({ error: 'device_save_failed', message: devErr.message }, { status: 500 });
  }

  const { data: restRow } = await admin
    .from('restaurants')
    .select('print_locale')
    .eq('id', p.restaurant_id)
    .single();

  const locale = (restRow?.print_locale as 'zh' | 'en' | 'pt' | undefined) ?? 'pt';

  const { error: jobErr } = await admin.from('print_jobs').insert({
    restaurant_id: p.restaurant_id,
    type: 'order_receipt',
    status: 'pending',
    payload: {
      order_id: PRINT_AGENT_CONNECTION_TEST_ORDER_ID,
      locale,
      connection_test: true,
      lines: [{ display_name: 'Mesa print agent — connection test', qty: 1 }],
    },
  });

  if (jobErr) {
    // Pairing is consumed and device saved; do not roll back — operator can retry print from queue.
    console.error('print_agent claim: connection test job insert failed', jobErr);
  }

  const agentjwt = signPrintAgentJwt(
    { restaurant_id: p.restaurant_id, device_id: deviceId },
    jwtSecret,
    PRINT_AGENT_CREDENTIAL_TTL_SEC,
  );

  claimRecordSuccess(ip);

  return NextResponse.json({
    agentjwt,
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    valid_until: validUntil,
    restaurant_id: p.restaurant_id,
  });
}
