import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import {
  isOpsListRangeUnsatisfiable,
  parseOpsListPage,
  parseOpsListPageSize,
  opsListEmptyPagePayload,
} from '@/lib/ops-list-pagination';
import { loadRestaurantInstallContexts } from '@/lib/ops-restaurant-install-context';


export async function GET(req: Request) {
  const { ctx, error, admin } = await requirePlatformAdmin();
  if (error || !ctx || !admin) return error!;

  const url = new URL(req.url);
  const page = parseOpsListPage(url.searchParams);
  const pageSize = parseOpsListPageSize(url.searchParams);
  const q = (url.searchParams.get('q') || '').trim();
  const mode = (url.searchParams.get('mode') || '').trim();

  let query = admin
    .from('restaurants')
    .select(
      'id, name, slug, plan, deployment_mode, license_valid_until, suspended_at, suspension_reason, owner_email, owner_id, license_checked_at, license_offline_grace_days, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  if (mode === 'cloud' || mode === 'on_prem') {
    query = query.eq('deployment_mode', mode);
  }
  if (q) {
    const escaped = q.replace(/[%_\\]/g, '\\$&');
    query = query.or(
      `name.ilike.%${escaped}%,slug.ilike.%${escaped}%,owner_email.ilike.%${escaped}%`,
    );
  }

  const from = (page - 1) * pageSize;
  const { data: rows, error: listError, count } = await query.range(from, from + pageSize - 1);
  if (listError) {
    if (isOpsListRangeUnsatisfiable(listError)) {
      return NextResponse.json(opsListEmptyPagePayload(page, pageSize, listError));
    }
    return NextResponse.json({ error: 'list_failed', detail: listError.message }, { status: 500 });
  }

  const ids = (rows || []).map((r) => r.id as string);
  const installById = await loadRestaurantInstallContexts(admin, ids);

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
      deploymentMode: r.deployment_mode,
      licenseValidUntil: r.license_valid_until,
      suspendedAt: r.suspended_at,
      suspensionReason: r.suspension_reason,
      ownerEmail: r.owner_email,
      ownerId: r.owner_id,
      createdAt: r.created_at,
      installPhase: ctx.installPhase,
      licenseCheckedAt: r.license_checked_at ?? null,
      lastCheckinAt: ctx.lastCheckinAt,
      offlineGraceDays: r.license_offline_grace_days ?? 7,
      pendingExpiresAt: ctx.pendingExpiresAt,
    };
  });

  return NextResponse.json({
    items,
    page,
    pageSize: pageSize,
    total: count ?? 0,
  });
}
