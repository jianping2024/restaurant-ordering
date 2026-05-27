import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { maskPairingCode } from '@/lib/print-agent-pairing-code';
import { isPendingPairing } from '@/lib/print-agent-pairing-slots';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from('print_agent_pairings')
    .select('id, expires_at, consumed_at, revoked_at, code')
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  const pairings = (rows || []).map((r) => ({
    id: r.id,
    expires_at: r.expires_at,
    consumed_at: r.consumed_at,
    revoked_at: r.revoked_at,
    code_mask: maskPairingCode(String(r.code), Boolean(r.consumed_at)),
    pending: isPendingPairing({
      expires_at: r.expires_at,
      consumed_at: r.consumed_at,
      revoked_at: r.revoked_at,
    }),
  }));

  return NextResponse.json({
    pairings,
    pending_count: pairings.filter((p) => p.pending).length,
  });
}
