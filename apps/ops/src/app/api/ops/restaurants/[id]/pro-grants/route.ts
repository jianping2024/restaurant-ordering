import { NextResponse } from 'next/server';
import { sanitizePremiumKeyGrants } from '@mesa/shared';
import { requirePlatformAdmin, requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';
import { replaceRestaurantProFeatureGrants } from '@/lib/pro-feature-grants';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { error, admin } = await requirePlatformAdmin();
  if (error || !admin) return error!;

  const { id } = await context.params;
  const { data, error: qErr } = await admin
    .from('restaurant_pro_feature_grants')
    .select('feature_key')
    .eq('restaurant_id', id);

  if (qErr) {
    return NextResponse.json({ error: 'fetch_failed', detail: qErr.message }, { status: 500 });
  }

  return NextResponse.json({
    featureKeys: sanitizePremiumKeyGrants((data ?? []).map((row) => row.feature_key)),
  });
}

export async function PUT(req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!Array.isArray(body.featureKeys)) {
    return NextResponse.json({ error: 'feature_keys_required' }, { status: 400 });
  }

  const { data: restaurant, error: fetchError } = await admin
    .from('restaurants')
    .select('id, plan')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'fetch_failed', detail: fetchError.message }, { status: 500 });
  }
  if (!restaurant) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (restaurant.plan !== 'pro') {
    return NextResponse.json(
      {
        error: 'plan_not_pro',
        message: '当前套餐是 basic，不能改 Pro 功能包。请先保存为 pro。',
      },
      { status: 409 },
    );
  }

  const replaced = await replaceRestaurantProFeatureGrants(admin, id, body.featureKeys);
  if (!replaced.ok) {
    return NextResponse.json(
      { error: replaced.error, detail: replaced.detail },
      { status: replaced.status },
    );
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'restaurant.pro_grants_set',
    targetType: 'restaurant',
    targetId: id,
    restaurantId: id,
    metadata: { featureKeys: replaced.featureKeys },
  });

  return NextResponse.json({ ok: true, featureKeys: replaced.featureKeys });
}
