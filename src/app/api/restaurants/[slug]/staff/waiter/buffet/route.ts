import { NextResponse } from 'next/server';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { buildBuffetBaseLine, stripBuffetBaseLines } from '@/lib/buffet-order';
import { deriveOrderStatusFromItems } from '@/lib/order-status';
import { sumLineTotals } from '@/lib/cart-totals';
import { createAdminClient } from '@/lib/supabase/admin';
import type { OrderItem } from '@/types';

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

  let body: {
    table_number?: unknown;
    buffet_id?: unknown;
    adult_count?: unknown;
    child_count?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableNumber = Number(body.table_number);
  const buffetId = typeof body.buffet_id === 'string' ? body.buffet_id : '';
  const adultCount = Math.max(0, Math.floor(Number(body.adult_count) || 0));
  const childCount = Math.max(0, Math.floor(Number(body.child_count) || 0));

  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 30 || !buffetId) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

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

  let { data: session } = await admin
    .from('table_sessions')
    .select('id, status')
    .eq('restaurant_id', ctx.restaurant_id)
    .eq('table_number', tableNumber)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session?.id) {
    const { data: createdSession, error: csErr } = await admin
      .from('table_sessions')
      .insert({
        restaurant_id: ctx.restaurant_id,
        table_number: tableNumber,
        status: 'open',
      })
      .select('id, status')
      .single();
    if (csErr || !createdSession) {
      return NextResponse.json({ error: 'session_create_failed' }, { status: 500 });
    }
    session = createdSession;
  }

  if (session.status === 'billing') {
    return NextResponse.json({ error: 'session_billing' }, { status: 409 });
  }

  const sessionId = session.id as string;

  const { data: openOrder } = await admin
    .from('orders')
    .select('id, items, updated_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const mergedItems: OrderItem[] = [
    ...stripBuffetBaseLines((openOrder?.items || []) as OrderItem[]),
    line,
  ];
  const total = sumLineTotals(mergedItems);
  const nextStatus = deriveOrderStatusFromItems(mergedItems);

  if (openOrder?.id) {
    const { error: updErr } = await admin
      .from('orders')
      .update({
        items: mergedItems,
        total_amount: total,
        status: nextStatus,
      })
      .eq('id', openOrder.id)
      .eq('updated_at', openOrder.updated_at);

    if (updErr) {
      return NextResponse.json({ error: 'conflict' }, { status: 409 });
    }
  } else {
    const { error: insErr } = await admin.from('orders').insert({
      restaurant_id: ctx.restaurant_id,
      session_id: sessionId,
      table_number: tableNumber,
      status: nextStatus,
      items: mergedItems,
      total_amount: total,
    });
    if (insErr) {
      return NextResponse.json({ error: 'insert_failed', message: insErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
