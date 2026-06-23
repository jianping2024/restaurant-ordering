import { NextResponse } from 'next/server';
import { isPrintAgentDeviceActive, isPrintAgentDeviceOnline } from '@mesa/shared';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import { pickRestaurantJoin, type RestaurantJoinRow } from '@/lib/supabase-restaurant-join';

const PAGE_SIZE = 20;

const DEVICE_COLUMNS =
  'id, restaurant_id, label, paired_at, valid_until, revoked_at, last_seen, agent_version, last_print_at, last_print_status, restaurants!inner(name, slug)';

type DeviceRow = {
  id: string;
  restaurant_id: string;
  label: string | null;
  paired_at: string;
  valid_until: string;
  revoked_at: string | null;
  last_seen: string | null;
  agent_version: string | null;
  last_print_at: string | null;
  last_print_status: string | null;
  restaurants: RestaurantJoinRow;
};

function mapDevice(row: DeviceRow) {
  const rest = pickRestaurantJoin(row.restaurants);
  const active = isPrintAgentDeviceActive(row.revoked_at, row.valid_until);
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    restaurantName: rest.name,
    restaurantSlug: rest.slug,
    label: row.label,
    pairedAt: row.paired_at,
    validUntil: row.valid_until,
    revokedAt: row.revoked_at,
    lastSeen: row.last_seen,
    agentVersion: row.agent_version,
    lastPrintAt: row.last_print_at,
    lastPrintStatus: row.last_print_status,
    active,
    online: active && isPrintAgentDeviceOnline(row.last_seen),
  };
}

export async function GET(req: Request) {
  const { error, admin } = await requirePlatformAdmin();
  if (error || !admin) return error!;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const restaurantId = (url.searchParams.get('restaurantId') || '').trim();
  const status = (url.searchParams.get('status') || 'all').trim();
  const q = (url.searchParams.get('q') || '').trim();

  let query = admin
    .from('print_agent_devices')
    .select(DEVICE_COLUMNS, { count: 'exact' })
    .order('last_seen', { ascending: false, nullsFirst: false });

  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId);
  }
  if (status === 'active') {
    query = query.is('revoked_at', null).gt('valid_until', new Date().toISOString());
  } else if (status === 'revoked') {
    query = query.not('revoked_at', 'is', null);
  }
  if (q) {
    const escaped = q.replace(/[%_\\]/g, '\\$&');
    query = query.or(`name.ilike.%${escaped}%,slug.ilike.%${escaped}%`, {
      referencedTable: 'restaurants',
    });
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, error: listError, count } = await query.range(from, from + PAGE_SIZE - 1);

  if (listError) {
    return NextResponse.json({ error: 'list_failed', detail: listError.message }, { status: 500 });
  }

  return NextResponse.json({
    items: (rows || []).map((row) => mapDevice(row as DeviceRow)),
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
  });
}
