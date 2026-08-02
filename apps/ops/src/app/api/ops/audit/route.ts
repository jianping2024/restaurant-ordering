import { NextResponse } from 'next/server';
import {
  AUDIT_LOG_COLUMNS,
  enrichAuditLogRows,
  type AuditLogDbRow,
} from '@/lib/ops-audit-log';
import { requirePlatformAdmin } from '@/lib/platform-auth';

import { isOpsListRangeUnsatisfiable, parseOpsListPage,
  parseOpsListPageSize, opsListEmptyPagePayload } from '@/lib/ops-list-pagination';


export async function GET(req: Request) {
  const { error, admin } = await requirePlatformAdmin();
  if (error || !admin) return error!;

  const url = new URL(req.url);
  const page = parseOpsListPage(url.searchParams);
  const pageSize = parseOpsListPageSize(url.searchParams);
  const action = (url.searchParams.get('action') || '').trim();
  const restaurantId = (url.searchParams.get('restaurantId') || '').trim();

  let query = admin
    .from('platform_admin_audit_log')
    .select(AUDIT_LOG_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (action) query = query.eq('action', action);
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);

  const from = (page - 1) * pageSize;
  const { data: rows, error: listError, count } = await query.range(from, from + pageSize - 1);

  if (listError) {
    if (isOpsListRangeUnsatisfiable(listError)) {
      return NextResponse.json(opsListEmptyPagePayload(page, pageSize, listError));
    }
    return NextResponse.json({ error: 'list_failed', detail: listError.message }, { status: 500 });
  }

  const items = await enrichAuditLogRows(admin, (rows || []) as AuditLogDbRow[]);

  return NextResponse.json({
    items,
    page,
    pageSize: pageSize,
    total: count ?? 0,
  });
}
