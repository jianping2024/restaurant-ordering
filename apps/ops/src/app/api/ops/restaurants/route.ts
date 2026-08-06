import { NextResponse } from 'next/server';
import {
  createRestaurantWithOwner,
  isDeploymentMode,
  parseBuffetServiceMode,
  registerOnPremRestaurant,
  type PrintLocale,
} from '@mesa/shared';
import { fetchUserEmailsMap } from '@/lib/ops-user-lookup';
import { requirePlatformAdmin, requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';
import {
  isOpsListRangeUnsatisfiable,
  parseOpsListPage,
  parseOpsListPageSize,
  opsListEmptyPagePayload,
} from '@/lib/ops-list-pagination';
import { loadRestaurantInstallContexts } from '@/lib/ops-restaurant-install-context';
import { countOpsSuspendedRestaurants } from '@/lib/ops-suspended-count';


export async function GET(req: Request) {
  const { ctx, error, admin } = await requirePlatformAdmin();
  if (error || !ctx || !admin) return error!;

  const url = new URL(req.url);
  const page = parseOpsListPage(url.searchParams);
  const pageSize = parseOpsListPageSize(url.searchParams);
  const q = (url.searchParams.get('q') || '').trim();
  const plan = (url.searchParams.get('plan') || '').trim();
  const ownerEmail = (url.searchParams.get('ownerEmail') || '').trim().toLowerCase();

  let query = admin
    .from('restaurants')
    .select(
      'id, name, slug, plan, created_at, owner_id, owner_email, print_locale, feature_flags, suspended_at, suspension_reason, deployment_mode, license_valid_until, license_checked_at, license_offline_grace_days',
      { count: 'exact' },
    )
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
      let summary = { restaurantCount: 0, suspendedCount: 0 };
      try {
        summary = await countOpsSuspendedRestaurants(admin);
      } catch {
        /* keep zeros */
      }
      return NextResponse.json({
        items: [],
        page,
        pageSize: pageSize,
        total: 0,
        summary,
      });
    }
    query = query.eq('owner_id', owner.id);
  }
  if (q) {
    const escaped = q.replace(/[%_\\]/g, '\\$&');
    query = query.or(`name.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
  }

  const from = (page - 1) * pageSize;
  const [{ data: rows, error: listError, count }, summary] = await Promise.all([
    query.range(from, from + pageSize - 1),
    countOpsSuspendedRestaurants(admin).catch(() => ({
      restaurantCount: 0,
      suspendedCount: 0,
    })),
  ]);

  if (listError) {
    if (isOpsListRangeUnsatisfiable(listError)) {
      return NextResponse.json({
        ...opsListEmptyPagePayload(page, pageSize, listError),
        summary,
      });
    }
    return NextResponse.json({ error: 'list_failed', detail: listError.message }, { status: 500 });
  }

  const ownerEmails = await fetchUserEmailsMap(
    admin,
    (rows || []).map((r) => r.owner_id).filter((id): id is string => Boolean(id)),
  );

  const installById = await loadRestaurantInstallContexts(
    admin,
    (rows || []).map((r) => r.id as string),
  );

  const items = (rows || []).map((r) => {
    const ctx = installById.get(r.id) || {
      installPhase: 'none' as const,
      lastCheckinAt: null,
      pendingExpiresAt: null,
    };
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      plan: r.plan,
      createdAt: r.created_at,
      ownerId: r.owner_id,
      ownerEmail: r.owner_email || (r.owner_id ? ownerEmails.get(r.owner_id) ?? null : null),
      printLocale: r.print_locale,
      featureFlags: r.feature_flags,
      suspendedAt: r.suspended_at,
      suspensionReason: r.suspension_reason,
      deploymentMode: r.deployment_mode,
      licenseValidUntil: r.license_valid_until,
      licenseCheckedAt: r.license_checked_at ?? null,
      lastCheckinAt: ctx.lastCheckinAt,
      installPhase: ctx.installPhase,
      offlineGraceDays: r.license_offline_grace_days ?? 7,
    };
  });

  return NextResponse.json({
    items,
    page,
    pageSize: pageSize,
    total: count ?? 0,
    summary,
  });
}

export async function POST(req: Request) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  let body: {
    deploymentMode?: string;
    restaurantName?: string;
    email?: string;
    password?: string;
    printLocale?: PrintLocale;
    countryCode?: string;
    slug?: string;
    licenseValidUntil?: string | null;
    buffetServiceMode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const buffetServiceMode = parseBuffetServiceMode(body.buffetServiceMode);
  if (!buffetServiceMode) {
    return NextResponse.json({ error: 'invalid_buffet_service_mode' }, { status: 400 });
  }

  const deploymentMode = body.deploymentMode ?? 'cloud';
  if (!isDeploymentMode(deploymentMode)) {
    return NextResponse.json({ error: 'invalid_deployment_mode' }, { status: 400 });
  }

  if (deploymentMode === 'on_prem') {
    const result = await registerOnPremRestaurant(admin, {
      name: body.restaurantName || '',
      ownerEmail: body.email || '',
      printLocale: body.printLocale,
      countryCode: body.countryCode,
      slug: body.slug,
      licenseValidUntil: body.licenseValidUntil,
      buffetServiceMode,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, detail: result.detail },
        { status: result.status },
      );
    }
    await writePlatformAudit(admin, {
      actorUserId: ctx.userId,
      action: 'restaurant.register_on_prem',
      targetType: 'restaurant',
      targetId: result.restaurantId,
      restaurantId: result.restaurantId,
      metadata: {
        slug: result.slug,
        deploymentMode: 'on_prem',
        buffetServiceMode,
      },
    });
    return NextResponse.json({
      ok: true,
      slug: result.slug,
      restaurantId: result.restaurantId,
      deploymentMode: 'on_prem',
    });
  }

  const result = await createRestaurantWithOwner(admin, {
    name: body.restaurantName || '',
    email: body.email || '',
    password: body.password || '',
    printLocale: body.printLocale,
    countryCode: body.countryCode,
    slug: body.slug,
    buffetServiceMode,
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
    metadata: {
      slug: result.slug,
      ownerId: result.ownerId,
      deploymentMode: 'cloud',
      buffetServiceMode,
    },
  });

  return NextResponse.json({
    ok: true,
    slug: result.slug,
    restaurantId: result.restaurantId,
    deploymentMode: 'cloud',
  });
}
