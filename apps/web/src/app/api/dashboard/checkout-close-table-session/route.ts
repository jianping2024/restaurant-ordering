import { NextResponse } from 'next/server';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { loadCloseTableSessionActor } from '@/lib/table-session/load-close-table-actor';
import { closeTableSessionFrontdeskCheckout } from '@/lib/table-session/close-table-session.service';
import { httpStatusForSushiSettlementError } from '@/lib/sushi-settlement-rebalance';

export const runtime = 'nodejs';

/** Frontdesk/cashier/owner checkout close — settled path (settlement + close, orders preserved). */
export async function POST(req: Request) {
  const actorCtx = await loadCloseTableSessionActor({ requireWritable: true });
  if ('error' in actorCtx) {
    return NextResponse.json({ error: actorCtx.error }, { status: actorCtx.status });
  }

  let body: { table_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableId = parseTableIdParam(body.table_id);
  if (!tableId) {
    return NextResponse.json({ error: 'invalid_table_id' }, { status: 400 });
  }

  const result = await closeTableSessionFrontdeskCheckout({
    admin: actorCtx.admin,
    restaurantId: actorCtx.restaurantId,
    userId: actorCtx.userId,
    closedReason: actorCtx.closedReason,
    tableId,
  });

  if (!result.ok) {
    if (result.code === 'no_session') {
      return NextResponse.json({ error: result.code, message: result.message }, { status: 404 });
    }
    if (
      result.code === 'limited_item_requires_headcount' ||
      result.code === 'over_limit_price_missing' ||
      result.code === 'catalog_lookup_failed' ||
      result.code === 'persist_failed'
    ) {
      return NextResponse.json(
        { error: result.code, message: result.message },
        { status: httpStatusForSushiSettlementError(result.code) },
      );
    }
    return NextResponse.json({ error: result.code, message: result.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, session_id: result.session_id });
}
