import { NextResponse } from 'next/server';
import { registerFiscalSigningDevice } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyActiveAgentBearer } from '@/lib/print-agent-auth';

export const runtime = 'nodejs';

/** Agent: register device public key B' for fiscal product-key wrap. */
export async function POST(req: Request) {
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

  let body: { device_public_key?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const devicePublicKey = typeof body.device_public_key === 'string' ? body.device_public_key : '';
  const result = await registerFiscalSigningDevice(admin, {
    restaurantId: ctx.restaurant_id,
    deviceId: ctx.device_id,
    devicePublicKey,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    installation_id: result.installation.id,
    status: result.installation.status,
  });
}
