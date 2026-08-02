import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import {
  OPS_LIST_PAGE_SIZE,
  isOpsListRangeUnsatisfiable,
  parseOpsListPage,
  opsListEmptyPagePayload,
} from '@/lib/ops-list-pagination';
import { pickRestaurantJoin, type RestaurantJoinRow } from '@/lib/supabase-restaurant-join';

const PAGE_SIZE = OPS_LIST_PAGE_SIZE;

type PairingRow = {
  id: string;
  restaurant_id: string;
  code: string;
  expires_at: string;
  consumed_at: string | null;
  revoked_at: string | null;
  created_at: string;
  restaurants: RestaurantJoinRow;
};

export async function GET(req: Request) {
  const { error, admin } = await requirePlatformAdmin();
  if (error || !admin) return error!;

  const url = new URL(req.url);
  const page = parseOpsListPage(url.searchParams);
  const restaurantId = (url.searchParams.get('restaurantId') || '').trim();
  const pendingOnly = url.searchParams.get('pending') !== '0';

  const nowIso = new Date().toISOString();

  let query = admin
    .from('print_agent_pairings')
    .select(
      'id, restaurant_id, code, expires_at, consumed_at, revoked_at, created_at, restaurants!inner(name, slug)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId);
  }
  if (pendingOnly) {
    query = query.is('consumed_at', null).is('revoked_at', null).gt('expires_at', nowIso);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, error: listError, count } = await query.range(from, from + PAGE_SIZE - 1);

  if (listError) {
    if (isOpsListRangeUnsatisfiable(listError)) {
      return NextResponse.json(opsListEmptyPagePayload(page, PAGE_SIZE, listError));
    }
    return NextResponse.json({ error: 'list_failed', detail: listError.message }, { status: 500 });
  }

  const items = (rows || []).map((r) => {
    const rest = pickRestaurantJoin((r as PairingRow).restaurants);
    return {
      id: r.id,
      restaurantId: r.restaurant_id,
      restaurantName: rest.name,
      restaurantSlug: rest.slug,
      code: r.code,
      expiresAt: r.expires_at,
      consumedAt: r.consumed_at,
      revokedAt: r.revoked_at,
      createdAt: r.created_at,
      pending: !r.consumed_at && !r.revoked_at && r.expires_at > nowIso,
    };
  });

  return NextResponse.json({
    items,
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
  });
}
