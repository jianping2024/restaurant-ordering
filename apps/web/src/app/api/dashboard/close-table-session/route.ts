import { NextResponse } from 'next/server';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { parseCloseConfirmFromBody } from '@/lib/close-table-session-ui';
import { loadCloseTableSessionActor } from '@/lib/table-session/load-close-table-actor';
import { closeTableSessionManual } from '@/lib/table-session/close-table-session.service';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const actorCtx = await loadCloseTableSessionActor({ requireWritable: true });
  if ('error' in actorCtx) {
    return NextResponse.json({ error: actorCtx.error }, { status: actorCtx.status });
  }

  let body: {
    table_id?: unknown;
    confirm_close?: unknown;
    confirm_checkout_close?: unknown;
    close_reason?: unknown;
    close_reason_detail?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableId = parseTableIdParam(body.table_id);
  if (!tableId) {
    return NextResponse.json({ error: 'invalid_table_id' }, { status: 400 });
  }

  const unpaidReason = typeof body.close_reason === 'string' ? body.close_reason : null;
  const unpaidReasonDetail =
    typeof body.close_reason_detail === 'string' ? body.close_reason_detail : null;

  const result = await closeTableSessionManual({
    admin: actorCtx.admin,
    restaurantId: actorCtx.restaurantId,
    userId: actorCtx.userId,
    actor: actorCtx.actor,
    closedReason: actorCtx.closedReason,
    tableId,
    confirmClose: parseCloseConfirmFromBody(body),
    unpaidReason,
    unpaidReasonDetail,
  });

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
    if (result.code === 'forbidden') {
      return NextResponse.json({ error: result.code, message: result.message }, { status: 403 });
    }
    if (
      result.code === 'reason_required' ||
      result.code === 'invalid_reason' ||
      result.code === 'reason_detail_required'
    ) {
      return NextResponse.json(
        {
          error: result.code,
          session_id: result.session_id,
          is_unpaid_close: result.code === 'reason_required' ? true : undefined,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: result.code, message: result.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, session_id: result.session_id });
}
