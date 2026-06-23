import { NextResponse } from 'next/server';
import { revokePrintAgentDevice } from '@mesa/shared';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdmin();
  if (error || !ctx || !admin) return error!;

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

  const result = await revokePrintAgentDevice(admin, deviceId, restaurantId);
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 500;
    return NextResponse.json({ error: result.error, detail: result.detail }, { status });
  }

  const { data: device } = await admin
    .from('print_agent_devices')
    .select('label')
    .eq('id', deviceId)
    .maybeSingle();

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'device.revoke',
    targetType: 'print_agent_device',
    targetId: deviceId,
    restaurantId,
    metadata: { label: device?.label ?? null },
  });

  return NextResponse.json({ ok: true, deviceId: result.deviceId });
}
