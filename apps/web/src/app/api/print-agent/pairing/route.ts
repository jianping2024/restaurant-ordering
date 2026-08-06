import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { requireSettingsRestaurantAuth } from '@/lib/settings-restaurant-auth';
import { randomPairingCode } from '@/lib/print-agent-pairing-code';

export const runtime = 'nodejs';

export async function POST() {
  const auth = await requireSettingsRestaurantAuth('settings.print_assistant.manage', {
    requireWritable: true,
  });
  if (auth instanceof NextResponse) return auth;

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
