import { NextResponse } from 'next/server';
import {
  PRINT_AGENT_SUPPORT_TOKEN_TTL_SEC,
  signPrintAgentSupportJwt,
} from '@mesa/shared';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdmin();
  if (error || !ctx || !admin) return error!;

  const secret = process.env.PRINT_AGENT_JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { id: deviceId } = await context.params;

  let body: { restaurantId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const restaurantId = (body.restaurantId || '').trim();
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id_required' }, { status: 400 });
  }

  const { data: device, error: deviceError } = await admin
    .from('print_agent_devices')
    .select('id, label, revoked_at')
    .eq('id', deviceId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (deviceError) {
    return NextResponse.json({ error: 'lookup_failed', detail: deviceError.message }, { status: 500 });
  }
  if (!device) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (device.revoked_at) {
    return NextResponse.json({ error: 'device_revoked' }, { status: 409 });
  }

  const expiresAt = new Date(Date.now() + PRINT_AGENT_SUPPORT_TOKEN_TTL_SEC * 1000).toISOString();

  const { data: tokenRow, error: insertError } = await admin
    .from('print_agent_support_tokens')
    .insert({
      device_id: deviceId,
      restaurant_id: restaurantId,
      actor_user_id: ctx.userId,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (insertError || !tokenRow) {
    return NextResponse.json(
      { error: 'token_create_failed', detail: insertError?.message },
      { status: 500 },
    );
  }

  const supportToken = signPrintAgentSupportJwt(
    {
      jti: tokenRow.id,
      restaurant_id: restaurantId,
      device_id: deviceId,
      actor_user_id: ctx.userId,
    },
    secret,
  );

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'device.support_token.issue',
    targetType: 'print_agent_device',
    targetId: deviceId,
    restaurantId,
    metadata: { label: device.label ?? null, tokenId: tokenRow.id, expiresAt },
  });

  return NextResponse.json({
    supportToken,
    expiresAt,
    expiresInSec: PRINT_AGENT_SUPPORT_TOKEN_TTL_SEC,
    consumeUrl: '/api/print-agent/support-snapshot',
  });
}
