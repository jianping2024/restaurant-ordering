import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getOwnerRestaurantId } from '@/lib/print-agent-dashboard-auth';
import { randomPairingCode } from '@/lib/print-agent-pairing-code';
import { PRINT_AGENT_PAIRING_PENDING_SLOT_MAX } from '@/lib/print-agent-pairing-slots';

export const runtime = 'nodejs';

export async function POST() {
  const auth = await getOwnerRestaurantId({ requireWritable: true });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rid = auth.restaurantId;
  const nowIso = new Date().toISOString();

  const { count: slotCount, error: cErr } = await admin
    .from('print_agent_pairings')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', rid)
    .is('consumed_at', null)
    .is('revoked_at', null)
    .gt('expires_at', nowIso);

  if (cErr) {
    return NextResponse.json({ error: 'query_failed', message: cErr.message }, { status: 500 });
  }
  if ((slotCount ?? 0) >= PRINT_AGENT_PAIRING_PENDING_SLOT_MAX) {
    return NextResponse.json(
      {
        error: 'pairing_slot_full',
        message: `At most ${PRINT_AGENT_PAIRING_PENDING_SLOT_MAX} unused pairing codes per restaurant.`,
      },
      { status: 409 },
    );
  }

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count: rHour } = await admin
    .from('print_agent_pairings')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', rid)
    .gte('created_at', hourAgo);
  if ((rHour ?? 0) >= 6) {
    return NextResponse.json(
      { error: 'pairing_rate_restaurant', message: 'Too many pairing codes created this hour for this restaurant.' },
      { status: 429 },
    );
  }

  const { count: uHour } = await admin
    .from('print_agent_pairings')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', user.id)
    .gte('created_at', hourAgo);
  if ((uHour ?? 0) >= 10) {
    return NextResponse.json(
      { error: 'pairing_rate_user', message: 'Too many pairing codes created this hour for this account.' },
      { status: 429 },
    );
  }

  const minAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: recent } = await admin
    .from('print_agent_pairings')
    .select('id')
    .eq('restaurant_id', rid)
    .gte('created_at', minAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) {
    return NextResponse.json(
      { error: 'pairing_debounce', message: 'Wait at least 60 seconds between generating pairing codes.' },
      { status: 429 },
    );
  }

  let code = '';
  for (let attempt = 0; attempt < 48; attempt += 1) {
    code = randomPairingCode();
    const { data: clash } = await admin
      .from('print_agent_pairings')
      .select('id')
      .eq('code', code)
      .is('consumed_at', null)
      .is('revoked_at', null)
      .gt('expires_at', nowIso)
      .maybeSingle();
    if (!clash) break;
  }
  if (!code) {
    return NextResponse.json({ error: 'code_generation_failed' }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const { data: ins, error: insErr } = await admin
    .from('print_agent_pairings')
    .insert({
      restaurant_id: rid,
      code,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select('id, code, expires_at')
    .single();

  if (insErr || !ins) {
    return NextResponse.json(
      { error: 'insert_failed', message: insErr?.message ?? 'unknown' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: ins.id,
    code: ins.code,
    expires_at: ins.expires_at,
  });
}
