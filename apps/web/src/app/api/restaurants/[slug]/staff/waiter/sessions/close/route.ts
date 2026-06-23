import { NextResponse } from 'next/server';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { closeTableSessionWithCheckoutGuard } from '@/lib/table-session-close-guards';
import { parseCloseConfirmFromBody } from '@/lib/close-table-session-ui';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await staffAuthFromRequest(req, slug, 'waiter');
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { table_id?: unknown; confirm_close?: unknown; confirm_checkout_close?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableId = parseTableIdParam(body.table_id);
  if (!tableId) {
    return NextResponse.json({ error: 'invalid_table_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const result = await closeTableSessionWithCheckoutGuard(
    admin,
    ctx.restaurant_id,
    tableId,
    'waiter_closed',
    {
      confirm_close: parseCloseConfirmFromBody(body),
      closed_by_user_id: ctx.user_id,
    },
  );

  if (!result.ok) {
    if (result.code === 'no_session') {
      return NextResponse.json({ error: result.code, message: result.message }, { status: 404 });
    }
    if (result.code === 'close_confirm_required') {
      return NextResponse.json(
        { error: result.code, session_id: result.session_id, reasons: result.reasons },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: result.code, message: result.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, session_id: result.session_id });
}
