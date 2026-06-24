import { NextResponse } from 'next/server';
import {
  AUDIT_LOG_COLUMNS,
  enrichAuditLogRowsForCsv,
  type AuditLogDbRow,
} from '@/lib/ops-audit-log';
import { requirePlatformAdmin } from '@/lib/platform-auth';

const EXPORT_MAX = 5000;

export async function GET(req: Request) {
  const { error, admin } = await requirePlatformAdmin();
  if (error || !admin) return error!;

  const url = new URL(req.url);
  const action = (url.searchParams.get('action') || '').trim();
  const restaurantId = (url.searchParams.get('restaurantId') || '').trim();

  let query = admin
    .from('platform_admin_audit_log')
    .select(AUDIT_LOG_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(EXPORT_MAX);

  if (action) query = query.eq('action', action);
  if (restaurantId) query = query.eq('restaurant_id', restaurantId);

  const { data: rows, error: listError } = await query;
  if (listError) {
    return NextResponse.json({ error: 'export_failed', detail: listError.message }, { status: 500 });
  }

  const csv = await enrichAuditLogRowsForCsv(admin, (rows || []) as AuditLogDbRow[]);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mesa-ops-audit-${stamp}.csv"`,
    },
  });
}
