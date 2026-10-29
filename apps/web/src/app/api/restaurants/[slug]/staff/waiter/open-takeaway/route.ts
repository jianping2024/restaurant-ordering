import { NextResponse } from 'next/server';
import { AUDIT_EVENT, scheduleStaffRecordAudit } from '@/lib/audit';
import { scheduleOpenTableReceiptPrint } from '@/lib/open-table-receipt-enqueue';
import {
  loadTakeawayOrderingEnabled,
  loadTableInTakeawayGroup,
} from '@/lib/instore-takeaway-server';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { tableSessionOpenAuthFromRequest } from '@/lib/staff-api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  findActiveTableSession,
  openTableSessionIfAbsent,
} from '@/lib/table-session-open';

export const runtime = 'nodejs';

/** Cold-open a takeaway desk: stamp ordering_channel=takeaway, no buffet headcount. */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug?.trim();
  if (!slug) return NextResponse.json({ error: 'missing_slug' }, { status: 400 });

  const ctx = await tableSessionOpenAuthFromRequest(req, slug);
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { table_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const tableId = parseTableIdParam(body.table_id);
  if (!tableId) return NextResponse.json({ error: 'invalid_table_id' }, { status: 400 });

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const [enabled, inGroup] = await Promise.all([
    loadTakeawayOrderingEnabled(admin, ctx.restaurant_id),
    loadTableInTakeawayGroup(admin, ctx.restaurant_id, tableId),
  ]);
  if (!enabled || !inGroup) {
    return NextResponse.json({ error: 'not_takeaway_table' }, { status: 409 });
  }

  const { data: table, error: tableErr } = await admin
    .from('restaurant_tables')
    .select('id, display_name')
    .eq('id', tableId)
    .eq('restaurant_id', ctx.restaurant_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (tableErr || !table) {
    return NextResponse.json({ error: 'table_not_available' }, { status: 400 });
  }

  let existing;
  try {
    existing = await findActiveTableSession(admin, ctx.restaurant_id, tableId);
  } catch {
    return NextResponse.json({ error: 'session_lookup_failed' }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ error: 'already_open' }, { status: 409 });
  }

  const ensured = await openTableSessionIfAbsent(
    admin,
    {
      restaurant_id: ctx.restaurant_id,
      table_id: tableId,
      opened_by_user_id: ctx.user_id,
    },
    null,
  );
  if (!ensured.session) {
    return NextResponse.json(
      { error: ensured.error ?? 'session_create_failed' },
      { status: 500 },
    );
  }

  scheduleStaffRecordAudit(admin, AUDIT_EVENT.SESSION_OPENED, {
    restaurantId: ctx.restaurant_id,
    userId: ctx.user_id,
    role: ctx.role,
    context: {
      sessionId: ensured.session.id,
      tableName: (table.display_name as string) || '—',
      adultCount: 0,
      childCount: 0,
    },
  });
  scheduleOpenTableReceiptPrint({
    admin,
    restaurantId: ctx.restaurant_id,
    sessionId: ensured.session.id,
    tableId,
    tableDisplayName: (table.display_name as string) || '—',
  });

  return NextResponse.json({
    ok: true,
    session_id: ensured.session.id,
    ordering_channel: ensured.session.ordering_channel ?? 'takeaway',
  });
}
