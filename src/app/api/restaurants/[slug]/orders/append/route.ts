import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { distanceMeters, GEO_FENCE_MAX_METERS } from '@/lib/geo-distance';
import { orderEnqueueSecret, signOrderEnqueueToken } from '@/lib/order-enqueue-token';
import { orderAppendRateLimitCheck } from '@/lib/order-append-rate-limit';
import { deriveOrderStatusFromItems } from '@/lib/order-status';
import { coerceCartPrice, coerceCartQty, sumLineTotals } from '@/lib/cart-totals';
import { clientIpFromRequest } from '@/lib/request-client-ip';
import type { OrderItem } from '@/types';

export const runtime = 'nodejs';

const isDevBypassHost = (host: string) =>
  host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.endsWith('.local');

function parseItems(raw: unknown): OrderItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 80) return null;
  const items: OrderItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    const name_pt = typeof r.name_pt === 'string' ? r.name_pt.trim() : name;
    if (!name_pt) return null;
    const qty = coerceCartQty(Number(r.qty));
    if (qty < 1 || qty > 99) return null;
    const price = coerceCartPrice(Number(r.price));
    if (price < 0 || price > 9999) return null;
    items.push({
      id: typeof r.id === 'string' ? r.id : '',
      name: name || name_pt,
      name_pt,
      name_en: typeof r.name_en === 'string' ? r.name_en : undefined,
      name_zh: typeof r.name_zh === 'string' ? r.name_zh : undefined,
      qty,
      note: typeof r.note === 'string' ? r.note.slice(0, 500) : '',
      price,
      emoji: typeof r.emoji === 'string' ? r.emoji.slice(0, 8) : '🍽️',
      item_status: 'pending',
      batch_id: typeof r.batch_id === 'string' ? r.batch_id.slice(0, 64) : undefined,
      added_at: typeof r.added_at === 'string' ? r.added_at : new Date().toISOString(),
    });
  }
  const batchId = items[0]?.batch_id;
  if (!batchId || !items.every((i) => i.batch_id === batchId)) return null;
  return items;
}

/** Guest/waiter order submit: server-side geo fence + signed enqueue token. */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const secret = orderEnqueueSecret();
  if (!secret) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const ip = clientIpFromRequest(req);
  const rl = orderAppendRateLimitCheck(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  let body: {
    table_number?: unknown;
    items?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    waiter_flow?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableNumber = Number(body.table_number);
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 30) {
    return NextResponse.json({ error: 'invalid_table_number' }, { status: 400 });
  }

  const newItems = parseItems(body.items);
  if (!newItems) {
    return NextResponse.json({ error: 'invalid_items' }, { status: 400 });
  }

  const batchId = newItems[0].batch_id!;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: restaurant, error: rErr } = await admin
    .from('restaurants')
    .select('id, geo_latitude, geo_longitude')
    .eq('slug', slug)
    .maybeSingle();

  if (rErr || !restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
  }

  const rid = restaurant.id as string;
  const waiterFlow = body.waiter_flow === true;
  const staffWaiter = waiterFlow ? await staffAuthFromRequest(req, slug, 'waiter') : null;

  if (
    restaurant.geo_latitude != null &&
    restaurant.geo_longitude != null &&
    !staffWaiter
  ) {
    const lat = Number(body.latitude);
    const lon = Number(body.longitude);
    const host = req.headers.get('host') || '';
    const devBypass = process.env.NODE_ENV !== 'production' && isDevBypassHost(host);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: 'location_required' }, { status: 400 });
    }

    const dist = distanceMeters(
      lat,
      lon,
      Number(restaurant.geo_latitude),
      Number(restaurant.geo_longitude),
    );
    if (dist > GEO_FENCE_MAX_METERS && !devBypass) {
      return NextResponse.json({ error: 'location_too_far' }, { status: 403 });
    }
  }

  let { data: session } = await admin
    .from('table_sessions')
    .select('id, status')
    .eq('restaurant_id', rid)
    .eq('table_number', tableNumber)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session?.id) {
    const { data: created, error: csErr } = await admin
      .from('table_sessions')
      .insert({
        restaurant_id: rid,
        table_number: tableNumber,
        status: 'open',
      })
      .select('id, status')
      .single();
    if (csErr || !created) {
      return NextResponse.json({ error: 'session_create_failed' }, { status: 500 });
    }
    session = created;
  }

  if (session.status === 'billing') {
    return NextResponse.json({ error: 'session_billing' }, { status: 409 });
  }

  const sessionId = session.id as string;

  const { data: openOrder } = await admin
    .from('orders')
    .select('id, items')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let orderId: string;
  let hadDoneBefore = false;
  const batchTotal = sumLineTotals(newItems);

  if (openOrder?.id) {
    const prior = (openOrder.items || []) as OrderItem[];
    hadDoneBefore =
      prior.length > 0 && prior.every((item) => (item.item_status || 'pending') === 'done');
    const mergedItems = [...prior, ...newItems];
    const mergedTotal = sumLineTotals(mergedItems);
    const mergedStatus = deriveOrderStatusFromItems(mergedItems);
    const { error: updErr } = await admin
      .from('orders')
      .update({
        items: mergedItems,
        total_amount: mergedTotal,
        status: mergedStatus,
      })
      .eq('id', openOrder.id);
    if (updErr) {
      return NextResponse.json({ error: 'order_update_failed' }, { status: 500 });
    }
    orderId = openOrder.id as string;
  } else {
    const { data: inserted, error: insErr } = await admin
      .from('orders')
      .insert({
        restaurant_id: rid,
        session_id: sessionId,
        table_number: tableNumber,
        status: 'pending',
        items: newItems,
        total_amount: batchTotal,
      })
      .select('id')
      .single();
    if (insErr || !inserted) {
      return NextResponse.json({ error: 'order_insert_failed' }, { status: 500 });
    }
    orderId = inserted.id as string;
  }

  const enqueue_token = signOrderEnqueueToken(
    { restaurant_id: rid, order_id: orderId, batch_id: batchId },
    secret,
  );

  return NextResponse.json({
    ok: true,
    order_id: orderId,
    batch_id: batchId,
    session_id: sessionId,
    enqueue_token,
    had_done_before: hadDoneBefore,
    is_first_order: !openOrder?.id,
  });
}
