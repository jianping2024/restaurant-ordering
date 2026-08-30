import { NextResponse } from 'next/server';
import { pullFiscalSigningProvision } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyActiveAgentBearer } from '@/lib/print-agent-auth';

export const runtime = 'nodejs';

/** Agent: pull active wrapped product key C for this device. */
export async function GET(req: Request) {
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

  const result = await pullFiscalSigningProvision(admin, {
    restaurantId: ctx.restaurant_id,
    deviceId: ctx.device_id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    installation_id: result.installationId,
    signing_key_version: result.signingKeyVersion,
    product_public_key_pem: result.productPublicKeyPem,
    wrapped_private_key: result.wrappedPrivateKey,
  });
}
