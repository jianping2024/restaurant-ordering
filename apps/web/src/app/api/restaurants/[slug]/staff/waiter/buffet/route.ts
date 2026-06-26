import { NextResponse } from 'next/server';
import { openTableAuthFromRequest } from '@/lib/staff-api-auth';
import { buildBuffetBaseLine, isBuffetGuestCountsUnchanged, normalizeBuffetGuestCounts, parseResolvedBuffetPriceRpcRow } from '@/lib/buffet-order';
import { applyBuffetOpenToSession, mapToBuffetSessionOrders } from '@/lib/buffet-open-table';
import { fetchWaiterTableDetail } from '@/lib/staff-board';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { findActiveTableSession, openTableSessionIfAbsent } from '@/lib/table-session-open';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await openTableAuthFromRequest(req, slug);
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: {
    table_id?: unknown;
    buffet_id?: unknown;
    adult_count?: unknown;
    child_count?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableId = parseTableIdParam(body.table_id);
  const buffetId = typeof body.buffet_id === 'string' ? body.buffet_id : '';
  const { adults: adultCount, children: childCount } = normalizeBuffetGuestCounts(
    Number(body.adult_count) || 0,
    Number(body.child_count) || 0,
  );

  if (!tableId || !buffetId) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const [{ data: tableRow }, { data: buffet, error: buffetErr }, existingSession] = await Promise.all([
    admin
      .from('restaurant_tables')
      .select('id, display_name')
      .eq('restaurant_id', ctx.restaurant_id)
      .eq('id', tableId)
      .is('deleted_at', null)
      .maybeSingle(),
    admin
      .from('buffets')
      .select('id, name')
      .eq('id', buffetId)
      .eq('restaurant_id', ctx.restaurant_id)
      .eq('is_active', true)
      .maybeSingle(),
    findActiveTableSession(admin, ctx.restaurant_id, tableId),
  ]);

  if (!tableRow) {
    return NextResponse.json({ error: 'table_not_available' }, { status: 400 });
  }

  if (buffetErr || !buffet) {
    return NextResponse.json({ error: 'buffet_not_found' }, { status: 404 });
  }

  const displayName = tableRow.display_name as string;

  const ensured = await openTableSessionIfAbsent(
    admin,
    {
      restaurant_id: ctx.restaurant_id,
      table_id: tableId,
      opened_by_user_id: ctx.user_id,
    },
    existingSession,
  );
  if (!ensured.session) {
    return NextResponse.json(
      { error: 'session_create_failed', message: ensured.error },
      { status: 500 },
    );
  }

  const session = ensured.session;
  if (session.status === 'billing') {
    return NextResponse.json({ error: 'session_billing' }, { status: 409 });
  }

  const sessionId = session.id as string;

  const { data: sessionOrderRows, error: sessionOrdersErr } = await admin
    .from('orders')
    .select('id, items, updated_at, table_id, created_at, status')
    .eq('session_id', sessionId)
    .in('status', ['pending', 'cooking', 'done']);

  if (sessionOrdersErr) {
    return NextResponse.json(
      { error: 'orders_lookup_failed', message: sessionOrdersErr.message },
      { status: 500 },
    );
  }

  const sessionOrders = mapToBuffetSessionOrders(sessionOrderRows || []);
  const unchanged = isBuffetGuestCountsUnchanged(sessionOrders, buffetId, adultCount, childCount);

  if (!unchanged) {
    const { data: priceRows, error: priceError } = await admin.rpc('resolve_buffet_prices', {
      p_restaurant_id: ctx.restaurant_id,
      p_buffet_id: buffetId,
      p_at: new Date().toISOString(),
    });

    if (priceError) {
      return NextResponse.json({ error: 'price_resolve_failed', message: priceError.message }, { status: 500 });
    }

    const line = buildBuffetBaseLine({
      buffet,
      adultCount,
      childCount,
      resolved: parseResolvedBuffetPriceRpcRow(priceRows),
    });

    if (!line) {
      return NextResponse.json({ error: 'no_price_rule' }, { status: 400 });
    }

    const applied = await applyBuffetOpenToSession(admin, {
      restaurantId: ctx.restaurant_id,
      sessionId,
      tableId,
      displayName,
      line,
      sessionOrders,
    });

    if (!applied.ok) {
      if (applied.code === 'conflict') {
        return NextResponse.json({ error: 'conflict' }, { status: 409 });
      }
      return NextResponse.json(
        { error: applied.code, message: applied.message },
        { status: 500 },
      );
    }
  }

  const detail = await fetchWaiterTableDetail(admin, ctx.restaurant_id, tableId);
  return NextResponse.json({ ok: true, detail, ...(unchanged ? { unchanged: true } : {}) });
}
