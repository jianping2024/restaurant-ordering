import { NextResponse } from 'next/server';
import { setRestaurantSuspended } from '@/lib/license-control';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

/** Kept as thin wrapper → setRestaurantSuspended (licenses UI is the sole ops surface). */
export async function POST(req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id } = await context.params;
  const { data: restaurant, error: fetchError } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'fetch_failed', detail: fetchError.message }, { status: 500 });
  }
  if (!restaurant) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let body: { reason?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const result = await setRestaurantSuspended(admin, id, {
    suspend: true,
    reason: body.reason,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'restaurant.suspend',
    targetType: 'restaurant',
    targetId: restaurant.id,
    restaurantId: restaurant.id,
    metadata: { slug: restaurant.slug, reason: body.reason?.trim() || null },
  });

  return NextResponse.json({ ok: true, suspendedAt: result.suspendedAt });
}
