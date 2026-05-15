import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { maskPairingCode } from '@/lib/print-agent-pairing-code';

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
    .select('id, expires_at, consumed_at, code')
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  const pairings = (rows || []).map((r) => ({
    id: r.id,
    expires_at: r.expires_at,
    consumed_at: r.consumed_at,
    code_mask: maskPairingCode(String(r.code), Boolean(r.consumed_at)),
  }));

  return NextResponse.json({ pairings });
}
