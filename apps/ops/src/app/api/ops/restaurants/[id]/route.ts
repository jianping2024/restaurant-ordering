import { NextResponse } from 'next/server';
import {
  mergeRestaurantFeatureFlags,
  normalizeCountryCode,
  parseFeatureFlagsRecord,
  type PrintLocale,
} from '@mesa/shared';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRINT_LOCALES = new Set<PrintLocale>(['zh', 'en', 'pt']);
const PLANS = new Set(['free', 'pro']);

export async function PATCH(req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await admin
    .from('restaurants')
    .select(
      'id, name, slug, plan, address, phone, print_locale, country_code, feature_flags',
    )
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'fetch_failed', detail: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  const metadata: Record<string, unknown> = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: 'name_required' }, { status: 400 });
    }
    if (name !== existing.name) {
      updates.name = name;
      metadata.name = { from: existing.name, to: name };
    }
  }

  if (body.address === null || typeof body.address === 'string') {
    const address = typeof body.address === 'string' ? body.address.trim() || null : null;
    if (address !== existing.address) {
      updates.address = address;
      metadata.address = { from: existing.address, to: address };
    }
  }

  if (body.phone === null || typeof body.phone === 'string') {
    const phone = typeof body.phone === 'string' ? body.phone.trim() || null : null;
    if (phone !== existing.phone) {
      updates.phone = phone;
      metadata.phone = { from: existing.phone, to: phone };
    }
  }

  if (typeof body.printLocale === 'string') {
    const printLocale = body.printLocale as PrintLocale;
    if (!PRINT_LOCALES.has(printLocale)) {
      return NextResponse.json({ error: 'invalid_print_locale' }, { status: 400 });
    }
    if (printLocale !== existing.print_locale) {
      updates.print_locale = printLocale;
      metadata.printLocale = { from: existing.print_locale, to: printLocale };
    }
  }

  if (typeof body.countryCode === 'string') {
    const countryCode = normalizeCountryCode(body.countryCode);
    if (!countryCode) {
      return NextResponse.json({ error: 'invalid_country_code' }, { status: 400 });
    }
    if (countryCode !== existing.country_code) {
      updates.country_code = countryCode;
      metadata.countryCode = { from: existing.country_code, to: countryCode };
    }
  }

  if (typeof body.plan === 'string') {
    if (!PLANS.has(body.plan)) {
      return NextResponse.json({ error: 'invalid_plan' }, { status: 400 });
    }
    if (body.plan !== existing.plan) {
      updates.plan = body.plan;
      metadata.plan = { from: existing.plan, to: body.plan };
    }
  }

  if (body.featureFlags !== undefined) {
    const patch = parseFeatureFlagsRecord(body.featureFlags);
    if (!patch) {
      return NextResponse.json({ error: 'invalid_feature_flags' }, { status: 400 });
    }
    const nextFlags = mergeRestaurantFeatureFlags(existing.feature_flags, patch);
    updates.feature_flags = nextFlags;
    metadata.featureFlags = patch;
  }

  if (typeof body.slug === 'string') {
    const slug = body.slug.trim().toLowerCase();
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
    }
    if (slug !== existing.slug) {
      if (body.confirmSlugChange !== true) {
        return NextResponse.json(
          {
            error: 'slug_change_requires_confirmation',
            message: '更改 slug 会使现有二维码失效，请确认后再提交。',
          },
          { status: 409 },
        );
      }

      const { data: conflict } = await admin
        .from('restaurants')
        .select('id')
        .eq('slug', slug)
        .neq('id', id)
        .maybeSingle();

      if (conflict) {
        return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
      }

      updates.slug = slug;
      metadata.slug = { from: existing.slug, to: slug };
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const { error: updateError } = await admin.from('restaurants').update(updates).eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: 'update_failed', detail: updateError.message }, { status: 500 });
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'restaurant.update',
    targetType: 'restaurant',
    targetId: existing.id,
    restaurantId: existing.id,
    metadata,
  });

  return NextResponse.json({ ok: true });
}
