import { NextResponse } from 'next/server';
import { isLicenseExtendPeriod } from '@mesa/shared';
import { extendRestaurantPro } from '@/lib/pro-membership';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id } = await context.params;
  let body: { period?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!isLicenseExtendPeriod(body.period)) {
    return NextResponse.json({ error: 'invalid_period' }, { status: 400 });
  }

  const result = await extendRestaurantPro(admin, id, body.period);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'restaurant.pro_extend',
    targetType: 'restaurant',
    targetId: id,
    restaurantId: id,
    metadata: { period: body.period, proValidUntil: result.proValidUntil },
  });

  return NextResponse.json({ ok: true, proValidUntil: result.proValidUntil });
}
