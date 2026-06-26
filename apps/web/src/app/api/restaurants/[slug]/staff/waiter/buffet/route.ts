import { NextResponse } from 'next/server';
import { openTableAuthFromRequest } from '@/lib/staff-api-auth';
import { buildBuffetBaseLine } from '@/lib/buffet-order';
import { applyBuffetOpenToSession } from '@/lib/buffet-open-table';
import { createAdminClient } from '@/lib/supabase/admin';
import type { OrderItem } from '@/types';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { ensureOpenTableSession } from '@/lib/table-session-open';

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
  const adultCount = Math.max(0, Math.floor(Number(body.adult_count) || 0));
  const childCount = Math.max(0, Math.floor(Number(body.child_count) || 0));

  if (!tableId || !buffetId) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: tableRow } = await admin
    .from('restaurant_tables')
    .select('id, display_name')
    .eq('restaurant_id', ctx.restaurant_id)
    .eq('id', tableId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!tableRow) {
    return NextResponse.json({ error: 'table_not_available' }, { status: 400 });
  }

  const displayName = tableRow.display_name as string;

  const { data: buffet, error: bErr } = await admin
    .from('buffets')
    .select('id, name')
    .eq('id', buffetId)
    .eq('restaurant_id', ctx.restaurant_id)
    .eq('is_active', true)
    .maybeSingle();

  if (bErr || !buffet) {
    return NextResponse.json({ error: 'buffet_not_found' }, { status: 404 });
  }

  const { data: priceRows, error: priceError } = await admin.rpc('resolve_buffet_prices', {
    p_restaurant_id: ctx.restaurant_id,
    p_buffet_id: buffetId,
    p_at: new Date().toISOString(),
  });

  if (priceError) {
    return NextResponse.json({ error: 'price_resolve_failed', message: priceError.message }, { status: 500 });
  }

  const resolvedRow = Array.isArray(priceRows) ? priceRows[0] : priceRows;
  const resolved = {
    adult_price: resolvedRow?.adult_price != null ? Number(resolvedRow.adult_price) : null,
    child_price: resolvedRow?.child_price != null ? Number(resolvedRow.child_price) : null,
    rule_id: resolvedRow?.rule_id ?? null,
    time_slot_id: resolvedRow?.time_slot_id ?? null,
  };

  const line = buildBuffetBaseLine({
    buffet,
    adultCount,
    childCount,
    resolved,
  });

  if (!line) {
    return NextResponse.json({ error: 'no_price_rule' }, { status: 400 });
  }

  const ensured = await ensureOpenTableSession(admin, {
    restaurant_id: ctx.restaurant_id,
    table_id: tableId,
    opened_by_user_id: ctx.user_id,
  });
  if (!ensured.session) {
    return NextResponse.json({ error: 'session_create_failed', message: ensured.error }, { status: 500 });
  }
  const session = ensured.session;

  if (session.status === 'billing') {
    return NextResponse.json({ error: 'session_billing' }, { status: 409 });
  }

  const sessionId = session.id as string;

  const { data: sessionOrders, error: sessionOrdersErr } = await admin
    .from('orders')
    .select('id, items, updated_at, table_id, created_at')
    .eq('session_id', sessionId)
    .in('status', ['pending', 'cooking', 'done']);

  if (sessionOrdersErr) {
    return NextResponse.json(
      { error: 'orders_lookup_failed', message: sessionOrdersErr.message },
      { status: 500 },
    );
  }

  const applied = await applyBuffetOpenToSession(admin, {
    restaurantId: ctx.restaurant_id,
    sessionId,
    tableId,
    displayName,
    line,
    sessionOrders: (sessionOrders || []).map((row) => ({
      id: row.id as string,
      items: (row.items || []) as OrderItem[],
      updated_at: row.updated_at as string,
      table_id: row.table_id as string,
      created_at: row.created_at as string,
    })),
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

  return NextResponse.json({ ok: true });
}
