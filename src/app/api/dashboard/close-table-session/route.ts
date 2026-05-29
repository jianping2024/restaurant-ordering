import { NextResponse } from 'next/server';
import { loadOwnerDashboardTables } from '@/lib/dashboard-tables';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { closeTableSessionWithCheckoutGuard } from '@/lib/table-session-close-guards';
import { parseCloseConfirmFromBody } from '@/lib/close-table-session-ui';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const loaded = await loadOwnerDashboardTables();
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error, message: loaded.message }, { status: loaded.status });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
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

  const result = await closeTableSessionWithCheckoutGuard(
    loaded.admin,
    loaded.restaurant.id,
    tableId,
    'owner_closed',
    {
      confirm_close: parseCloseConfirmFromBody(body),
      closed_by_user_id: user.id,
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
