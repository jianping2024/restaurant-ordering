import { NextResponse } from 'next/server';
import {
  consumePrintAgentSupportToken,
  insertPlatformAdminAudit,
  loadPrintAgentSupportSnapshot,
  verifyPrintAgentSupportJwt,
} from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBearerToken } from '@/lib/print-agent-auth';

export const runtime = 'nodejs';

/** One-time read-only device + cloud config snapshot for ops troubleshooting. */
export async function GET(req: Request) {
  const secret = process.env.PRINT_AGENT_JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const claims = verifyPrintAgentSupportJwt(token, secret);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const consumed = await consumePrintAgentSupportToken(admin, claims.jti, {
    deviceId: claims.device_id,
    restaurantId: claims.restaurant_id,
  });
  if (!consumed) {
    return NextResponse.json({ error: 'token_used_or_expired' }, { status: 401 });
  }

  const snapshot = await loadPrintAgentSupportSnapshot(
    admin,
    claims.device_id,
    claims.restaurant_id,
    { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null },
  );
  if (!snapshot) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await insertPlatformAdminAudit(admin, {
    actorUserId: claims.actor_user_id,
    action: 'device.support_token.consume',
    targetType: 'print_agent_device',
    targetId: claims.device_id,
    restaurantId: claims.restaurant_id,
    metadata: { tokenId: claims.jti },
  });

  return NextResponse.json(snapshot);
}
