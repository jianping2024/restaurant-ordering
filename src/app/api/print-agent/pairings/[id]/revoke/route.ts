import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOwnerRestaurantId } from '@/lib/print-agent-dashboard-auth';

export const runtime = 'nodejs';

/** Void an unused pairing code so it no longer counts toward the pending slot limit. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await getOwnerRestaurantId();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const pairingId = params.id?.trim();
  if (!pairingId) {
    return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const nowIso = new Date().toISOString();
  const { data: row, error: uErr } = await admin
    .from('print_agent_pairings')
    .update({ revoked_at: nowIso })
    .eq('id', pairingId)
    .eq('restaurant_id', auth.restaurantId)
    .is('consumed_at', null)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .select('id')
    .maybeSingle();

  if (uErr) {
    return NextResponse.json({ error: 'update_failed', message: uErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json(
      { error: 'not_revokable', message: 'Code already used, expired, or voided.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, id: row.id });
}
