import { NextResponse } from 'next/server';
import { normalizePremiumKeyGrants, type PremiumKey } from '@mesa/shared';
import { requirePlatformAdmin, requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

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
    featureKeys: normalizePremiumKeyGrants((data ?? []).map((row) => row.feature_key)),
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

  const featureKeys = normalizePremiumKeyGrants(body.featureKeys);
  if (!Array.isArray(body.featureKeys)) {
    return NextResponse.json({ error: 'feature_keys_required' }, { status: 400 });
  }

  const { data: restaurant, error: fetchError } = await admin
    .from('restaurants')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'fetch_failed', detail: fetchError.message }, { status: 500 });
  }
  if (!restaurant) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { error: delErr } = await admin
    .from('restaurant_pro_feature_grants')
    .delete()
    .eq('restaurant_id', id);
  if (delErr) {
    return NextResponse.json({ error: 'update_failed', detail: delErr.message }, { status: 500 });
  }

  if (featureKeys.length > 0) {
    const rows = featureKeys.map((feature_key: PremiumKey) => ({
      restaurant_id: id,
      feature_key,
    }));
    const { error: insErr } = await admin.from('restaurant_pro_feature_grants').insert(rows);
    if (insErr) {
      return NextResponse.json({ error: 'update_failed', detail: insErr.message }, { status: 500 });
    }
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'restaurant.pro_grants_set',
    targetType: 'restaurant',
    targetId: id,
    restaurantId: id,
    metadata: { featureKeys },
  });

  return NextResponse.json({ ok: true, featureKeys });
}
