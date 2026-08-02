import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import {
  isOpsListRangeUnsatisfiable,
  parseOpsListPage,
  parseOpsListPageSize,
  opsListEmptyPagePayload,
} from '@/lib/ops-list-pagination';
import { pickRestaurantJoin, type RestaurantJoinRow } from '@/lib/supabase-restaurant-join';


const JOB_TYPES = new Set(['order_receipt', 'station_ticket', 'pre_bill']);
const JOB_STATUSES = new Set(['pending', 'processing', 'done', 'failed']);

type JobRow = {
  id: string;
  restaurant_id: string;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  claimed_by: string | null;
  table_display: string | null;
  table_id: string | null;
  restaurants: RestaurantJoinRow;
};

export async function GET(req: Request) {
  const { error, admin } = await requirePlatformAdmin();
  if (error || !admin) return error!;

  const url = new URL(req.url);
  const page = parseOpsListPage(url.searchParams);
  const pageSize = parseOpsListPageSize(url.searchParams);
  const restaurantId = (url.searchParams.get('restaurantId') || '').trim();
  const type = (url.searchParams.get('type') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();
  const tableQ = (url.searchParams.get('table') || '').trim();

  if (type && !JOB_TYPES.has(type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }
  if (status && !JOB_STATUSES.has(status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  let query = admin
    .from('print_jobs')
    .select(
      'id, restaurant_id, type, status, created_at, updated_at, error_message, claimed_by, table_display, table_id, restaurants!inner(name, slug)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId);
  }
  if (type) {
    query = query.eq('type', type);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (tableQ) {
    const escaped = tableQ.replace(/[%_\\]/g, '\\$&');
    query = query.ilike('table_display', `%${escaped}%`);
  }

  const from = (page - 1) * pageSize;
  const { data: rows, error: listError, count } = await query.range(from, from + pageSize - 1);

  if (listError) {
    if (isOpsListRangeUnsatisfiable(listError)) {
      return NextResponse.json(opsListEmptyPagePayload(page, pageSize, listError));
    }
    return NextResponse.json({ error: 'list_failed', detail: listError.message }, { status: 500 });
  }

  const items = (rows || []).map((r) => {
    const rest = pickRestaurantJoin((r as JobRow).restaurants);
    return {
      id: r.id,
      restaurantId: r.restaurant_id,
      restaurantName: rest.name,
      restaurantSlug: rest.slug,
      type: r.type,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      errorMessage: r.error_message,
      claimedBy: r.claimed_by,
      tableDisplay: r.table_display,
      tableId: r.table_id,
    };
  });

  return NextResponse.json({
    items,
    page,
    pageSize: pageSize,
    total: count ?? 0,
  });
}
