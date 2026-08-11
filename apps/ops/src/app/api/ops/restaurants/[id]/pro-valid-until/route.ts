import { NextResponse } from 'next/server';
import { setRestaurantProValidUntilDate } from '@/lib/pro-membership';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id } = await context.params;
  let body: { date?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const result = await setRestaurantProValidUntilDate(admin, id, body.date);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'restaurant.pro_set_valid_until',
    targetType: 'restaurant',
    targetId: id,
    restaurantId: id,
    metadata: { date: body.date, proValidUntil: result.proValidUntil },
  });

  return NextResponse.json({ ok: true, proValidUntil: result.proValidUntil });
}
