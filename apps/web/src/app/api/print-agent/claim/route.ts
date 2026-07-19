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
import { buildClaimDeviceRow, classifyClaimDevice } from '@/lib/print-agent-claim-device';
import {
  mintPrintAgentSession,
  printAgentAnonKey,
} from '@/lib/print-agent-staff-session';
import {
  ensurePrintAgentStaff,
  resolvePrintAgentCredentialTtlSec,
  PRINT_AGENT_NAME,
} from '@mesa/shared';

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

  const claimOutcome = classifyClaimDevice(existingDev, p.restaurant_id);

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

  const { data: restRow } = await admin
    .from('restaurants')
    .select('print_locale, print_agent_config, slug')
    .eq('id', p.restaurant_id)
    .single();

  const locale = (restRow?.print_locale as 'zh' | 'en' | 'pt' | undefined) ?? 'pt';
  const restaurantSlug = typeof restRow?.slug === 'string' ? restRow.slug : '';
  const credentialTtlSec = resolvePrintAgentCredentialTtlSec(restRow?.print_agent_config);
  const validUntil = new Date(Date.now() + credentialTtlSec * 1000).toISOString();

  const { error: devErr } = await admin.from('print_agent_devices').upsert(
    buildClaimDeviceRow(
      {
        deviceId,
        restaurantId: p.restaurant_id,
        pairingId: p.id,
        label: label || null,
        validUntil,
        lastSeen: nowIso,
      },
      claimOutcome,
    ),
    { onConflict: 'id' },
  );

  if (devErr) {
    await admin.from('print_agent_pairings').update({ consumed_at: null }).eq('id', p.id);
    claimRecordFailure(ip);
    return NextResponse.json({ error: 'device_save_failed', message: devErr.message }, { status: 500 });
  }

  const { error: jobErr } = await admin.from('print_jobs').insert({
    restaurant_id: p.restaurant_id,
    type: 'order_receipt',
    status: 'pending',
    payload: {
      order_id: PRINT_AGENT_CONNECTION_TEST_ORDER_ID,
      locale,
      connection_test: true,
      lines: [{ display_name: `${PRINT_AGENT_NAME} — connection test`, qty: 1 }],
    },
  });

  if (jobErr) {
    // Pairing is consumed and device saved; do not roll back — operator can retry print from queue.
    console.error('print_agent claim: connection test job insert failed', jobErr);
  }

  const agentjwt = signPrintAgentJwt(
    { restaurant_id: p.restaurant_id, device_id: deviceId },
    jwtSecret,
    credentialTtlSec,
  );

  let access_token: string | undefined;
  let refresh_token: string | undefined;
  let anon_key: string | undefined;

  if (restaurantSlug) {
    const ensured = await ensurePrintAgentStaff(admin, {
      restaurantId: p.restaurant_id,
      restaurantSlug,
    });
    if (ensured.ok) {
      const session = await mintPrintAgentSession(admin, ensured.email);
      const anon = printAgentAnonKey();
      if (session && anon) {
        access_token = session.access_token;
        refresh_token = session.refresh_token;
        anon_key = anon;
      }
    } else {
      console.error('print_agent claim: ensure staff failed', ensured.error, ensured.detail);
    }
  }

  claimRecordSuccess(ip);

  return NextResponse.json({
    agentjwt,
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    valid_until: validUntil,
    restaurant_id: p.restaurant_id,
    ...(access_token && refresh_token && anon_key
      ? { access_token, refresh_token, anon_key }
      : {}),
  });
}
