import { NextResponse } from 'next/server';
import { setRestaurantSuspended } from '@/lib/license-control';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id } = await context.params;
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('id', id)
    .maybeSingle();
  if (!restaurant) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const result = await setRestaurantSuspended(admin, id, { suspend: false });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'restaurant.resume',
    targetType: 'restaurant',
    targetId: restaurant.id,
    restaurantId: restaurant.id,
    metadata: { slug: restaurant.slug, via: 'licenses' },
  });

  return NextResponse.json({ ok: true });
}
