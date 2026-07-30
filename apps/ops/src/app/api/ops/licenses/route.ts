import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform-auth';

const PAGE_SIZE = 30;

type InstallationRow = {
  id: string;
  restaurant_id: string;
  status: string;
  expires_at: string;
  claimed_at: string | null;
  last_checkin_at: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const { ctx, error, admin } = await requirePlatformAdmin();
  if (error || !ctx || !admin) return error!;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const q = (url.searchParams.get('q') || '').trim();
  const mode = (url.searchParams.get('mode') || '').trim();

  let query = admin
    .from('restaurants')
    .select(
      'id, name, slug, plan, deployment_mode, license_valid_until, suspended_at, suspension_reason, owner_email, owner_id, created_at',
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

  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, error: listError, count } = await query.range(from, from + PAGE_SIZE - 1);
  if (listError) {
    return NextResponse.json({ error: 'list_failed', detail: listError.message }, { status: 500 });
  }

  const ids = (rows || []).map((r) => r.id as string);
  let installations: InstallationRow[] = [];
  if (ids.length > 0) {
    const { data } = await admin
      .from('restaurant_installations')
      .select('id, restaurant_id, status, expires_at, claimed_at, last_checkin_at, created_at')
      .in('restaurant_id', ids)
      .in('status', ['pending', 'claimed'])
      .order('created_at', { ascending: false });
    installations = (data || []) as InstallationRow[];
  }

  const installByRestaurant = new Map<string, InstallationRow[]>();
  for (const inst of installations) {
    const list = installByRestaurant.get(inst.restaurant_id) || [];
    list.push(inst);
    installByRestaurant.set(inst.restaurant_id, list);
  }

  const items = (rows || []).map((r) => {
    const insts = installByRestaurant.get(r.id) || [];
    const claimed = insts.find((i) => i.status === 'claimed') || null;
    const pending = insts.find((i) => i.status === 'pending') || null;
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
      installStatus: claimed ? 'claimed' : pending ? 'pending' : 'none',
      lastCheckinAt: claimed?.last_checkin_at ?? null,
      pendingExpiresAt: pending?.expires_at ?? null,
    };
  });

  return NextResponse.json({
    items,
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
  });
}
