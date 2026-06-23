import { NextResponse } from 'next/server';
import { createRestaurantWithOwner, type PrintLocale } from '@mesa/shared';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

const PAGE_SIZE = 20;

export async function GET(req: Request) {
  const { ctx, error, admin } = await requirePlatformAdmin();
  if (error || !ctx || !admin) return error!;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const q = (url.searchParams.get('q') || '').trim();
  const plan = (url.searchParams.get('plan') || '').trim();
  const ownerEmail = (url.searchParams.get('ownerEmail') || '').trim().toLowerCase();

  let query = admin
    .from('restaurants')
    .select('id, name, slug, plan, created_at, owner_id, print_locale, feature_flags, suspended_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false });

  if (plan === 'free' || plan === 'pro') {
    query = query.eq('plan', plan);
  }
  if (ownerEmail) {
    const { data: ownerData, error: ownerError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (ownerError) {
      return NextResponse.json(
        { error: 'owner_lookup_failed', detail: ownerError.message },
        { status: 500 },
      );
    }
    const owner = ownerData.users.find((u) => u.email?.toLowerCase() === ownerEmail);
    if (!owner) {
      return NextResponse.json({ items: [], page, pageSize: PAGE_SIZE, total: 0 });
    }
    query = query.eq('owner_id', owner.id);
  }
  if (q) {
    const escaped = q.replace(/[%_\\]/g, '\\$&');
    query = query.or(`name.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, error: listError, count } = await query.range(from, from + PAGE_SIZE - 1);

  if (listError) {
    return NextResponse.json({ error: 'list_failed', detail: listError.message }, { status: 500 });
  }

  const items = await Promise.all(
    (rows || []).map(async (r) => {
      const { data: owner } = await admin.auth.admin.getUserById(r.owner_id);
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        plan: r.plan,
        createdAt: r.created_at,
        ownerId: r.owner_id,
        ownerEmail: owner?.user?.email ?? null,
        printLocale: r.print_locale,
        featureFlags: r.feature_flags,
        suspendedAt: r.suspended_at,
      };
    }),
  );

  return NextResponse.json({
    items,
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
  });
}

export async function POST(req: Request) {
  const { ctx, error, admin } = await requirePlatformAdmin();
  if (error || !ctx || !admin) return error!;

  let body: {
    restaurantName?: string;
    email?: string;
    password?: string;
    printLocale?: PrintLocale;
    slug?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const result = await createRestaurantWithOwner(admin, {
    name: body.restaurantName || '',
    email: body.email || '',
    password: body.password || '',
    printLocale: body.printLocale,
    slug: body.slug,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  await writePlatformAudit(admin, {
    actorUserId: ctx.userId,
    action: 'restaurant.create',
    targetType: 'restaurant',
    targetId: result.restaurantId,
    restaurantId: result.restaurantId,
    metadata: { slug: result.slug, ownerId: result.ownerId },
  });

  return NextResponse.json({
    ok: true,
    slug: result.slug,
    restaurantId: result.restaurantId,
  });
}
