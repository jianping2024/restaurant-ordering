import { NextResponse } from 'next/server';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id } = await context.params;

  const { data: restaurant, error: fetchError } = await admin
    .from('restaurants')
    .select('id, slug, suspended_at')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'fetch_failed', detail: fetchError.message }, { status: 500 });
  }
  if (!restaurant) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!restaurant.suspended_at) {
    return NextResponse.json({ error: 'not_suspended' }, { status: 409 });
  }

  const { error: updateError } = await admin
    .from('restaurants')
    .update({
      suspended_at: null,
      suspension_reason: null,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json(
      { error: 'resume_failed', detail: updateError.message },
      { status: 500 },
    );
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'restaurant.resume',
    targetType: 'restaurant',
    targetId: restaurant.id,
    restaurantId: restaurant.id,
    metadata: { slug: restaurant.slug },
  });

  return NextResponse.json({ ok: true });
}
