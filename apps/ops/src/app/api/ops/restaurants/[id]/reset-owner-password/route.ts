import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

function randomPassword(length = 12): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function POST(req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdmin();
  if (error || !ctx || !admin) return error!;

  const { id } = await context.params;

  const { data: restaurant, error: fetchError } = await admin
    .from('restaurants')
    .select('id, owner_id, slug')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'fetch_failed', detail: fetchError.message }, { status: 500 });
  }
  if (!restaurant) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let body: { password?: string; forceChange?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const password = (body.password || '').trim() || randomPassword();
  if (password.length < 6) {
    return NextResponse.json({ error: 'password_too_short' }, { status: 400 });
  }

  const forceChange = body.forceChange !== false;
  const { error: updateError } = await admin.auth.admin.updateUserById(restaurant.owner_id, {
    password,
    user_metadata: forceChange ? { force_password_change: true } : {},
  });

  if (updateError) {
    return NextResponse.json(
      { error: 'reset_failed', detail: updateError.message },
      { status: 500 },
    );
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'owner.reset_password',
    targetType: 'user',
    targetId: restaurant.owner_id,
    restaurantId: restaurant.id,
    metadata: { slug: restaurant.slug, forceChange },
  });

  return NextResponse.json({ ok: true, temporaryPassword: password });
}
