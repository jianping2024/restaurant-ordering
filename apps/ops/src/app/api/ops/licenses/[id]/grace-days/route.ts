import { NextResponse } from 'next/server';
import { setRestaurantOfflineGraceDays } from '@/lib/license-control';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id } = await context.params;
  let body: { days?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const result = await setRestaurantOfflineGraceDays(admin, id, body.days);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'license.set_offline_grace_days',
    targetType: 'restaurant',
    targetId: id,
    restaurantId: id,
    metadata: { offlineGraceDays: result.offlineGraceDays },
  });

  return NextResponse.json({ ok: true, offlineGraceDays: result.offlineGraceDays });
}
