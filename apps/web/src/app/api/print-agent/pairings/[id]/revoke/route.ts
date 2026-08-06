import { NextResponse } from 'next/server';
import { revokePrintAgentPairing } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSettingsRestaurantAuth } from '@/lib/settings-restaurant-auth';

/** Void an unused pairing code so it cannot be claimed. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSettingsRestaurantAuth('settings.print_assistant.manage', {
    requireWritable: true,
  });
  if (auth instanceof NextResponse) return auth;

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

  const result = await revokePrintAgentPairing(admin, pairingId, auth.restaurantId);
  if (!result.ok) {
    const status = result.error === 'not_revokable' ? 409 : 500;
    return NextResponse.json(
      {
        error: result.error === 'not_revokable' ? 'not_revokable' : 'update_failed',
        message:
          result.error === 'not_revokable'
            ? 'Code already used, expired, or voided.'
            : result.detail,
      },
      { status },
    );
  }

  return NextResponse.json({ ok: true, id: result.pairingId });
}
