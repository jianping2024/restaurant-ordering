import { NextResponse } from 'next/server';
import { revokePrintAgentPairing } from '@mesa/shared';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdmin();
  if (error || !ctx || !admin) return error!;

  const { id: pairingId } = await context.params;

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

  const result = await revokePrintAgentPairing(admin, pairingId, restaurantId);
  if (!result.ok) {
    const status = result.error === 'not_revokable' ? 409 : 500;
    return NextResponse.json({ error: result.error, detail: result.detail }, { status });
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'pairing.revoke',
    targetType: 'print_agent_pairing',
    targetId: pairingId,
    restaurantId,
  });

  return NextResponse.json({ ok: true, pairingId: result.pairingId });
}
