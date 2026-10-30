import { NextResponse } from 'next/server';
import {
  parseProFeatureProduct,
  PREMIUM_KEYS,
  type PremiumKey,
  type ProFeatureProduct,
} from '@mesa/shared';
import { requirePlatformAdmin, requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

export async function GET() {
  const { error, admin } = await requirePlatformAdmin();
  if (error || !admin) return error!;

  const { data, error: qErr } = await admin
    .from('pro_feature_products')
    .select('feature_key, price_month_eur, price_year_eur, active, updated_at')
    .order('feature_key');

  if (qErr) {
    return NextResponse.json({ error: 'fetch_failed', detail: qErr.message }, { status: 500 });
  }

  const products = (data ?? [])
    .map((row) => parseProFeatureProduct(row))
    .filter((p): p is ProFeatureProduct => p != null);

  return NextResponse.json({ products });
}

export async function PATCH(req: Request) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const rawProducts = body.products;
  if (!Array.isArray(rawProducts)) {
    return NextResponse.json({ error: 'products_required' }, { status: 400 });
  }

  const updates: ProFeatureProduct[] = [];
  for (const item of rawProducts) {
    const parsed = parseProFeatureProduct(item);
    if (!parsed) {
      return NextResponse.json({ error: 'invalid_product' }, { status: 400 });
    }
    updates.push(parsed);
  }

  const seen = new Set<PremiumKey>();
  for (const product of updates) {
    if (seen.has(product.featureKey)) {
      return NextResponse.json({ error: 'duplicate_feature_key' }, { status: 400 });
    }
    seen.add(product.featureKey);
  }

  for (const key of PREMIUM_KEYS) {
    if (!seen.has(key)) {
      return NextResponse.json(
        { error: 'products_incomplete', message: `缺少功能定价：${key}` },
        { status: 400 },
      );
    }
  }

  const now = new Date().toISOString();
  const rows = updates.map((p) => ({
    feature_key: p.featureKey,
    price_month_eur: p.priceMonthEur,
    price_year_eur: p.priceYearEur,
    active: p.active,
    updated_at: now,
  }));

  const { error: upErr } = await admin.from('pro_feature_products').upsert(rows, {
    onConflict: 'feature_key',
  });
  if (upErr) {
    return NextResponse.json({ error: 'update_failed', detail: upErr.message }, { status: 500 });
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'settings.pro_prices_updated',
    targetType: 'platform_pro_catalog',
    targetId: 'default',
    metadata: {
      products: updates.map((p) => ({
        featureKey: p.featureKey,
        priceMonthEur: p.priceMonthEur,
        priceYearEur: p.priceYearEur,
        active: p.active,
      })),
    },
  });

  return NextResponse.json({ ok: true, products: updates });
}
