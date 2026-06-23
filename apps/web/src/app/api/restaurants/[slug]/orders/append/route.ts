import { NextResponse } from 'next/server';
import { isRestaurantSuspended } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { distanceMeters } from '@/lib/geo-distance';
import { normalizeOrderRadiusMeters } from '@/lib/order-radius';
import { orderEnqueueSecret, signOrderEnqueueToken } from '@/lib/order-enqueue-token';
import { orderAppendRateLimitCheck } from '@/lib/order-append-rate-limit';
import { deriveOrderStatusFromItems } from '@/lib/order-status';
import { sumLineTotals } from '@/lib/cart-totals';
import { clientIpFromRequest } from '@/lib/request-client-ip';
import { resolveAppendCartItems } from '@/lib/resolve-append-cart-items';
import type { OrderItem } from '@/types';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { guestOrderingEnabled } from '@/lib/guest-table-ordering';
import type { Order } from '@/types';

export const runtime = 'nodejs';

const isDevBypassHost = (host: string) =>
  host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.endsWith('.local');

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
    table_id?: unknown;
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

  const { data: restaurant, error: rErr } = await admin
    .from('restaurants')
    .select('id, geo_latitude, geo_longitude, order_radius_meters, suspended_at')
    .eq('slug', slug)
    .maybeSingle();

  if (rErr || !restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
  }
  if (isRestaurantSuspended(restaurant.suspended_at as string | null)) {
    return NextResponse.json({ error: 'restaurant_suspended' }, { status: 403 });
  }

  const rid = restaurant.id as string;
  const waiterFlow = body.waiter_flow === true;
  const staffWaiter = waiterFlow ? await staffAuthFromRequest(req, slug, 'waiter') : null;

  const { data: tableRow, error: tableErr } = await admin
    .from('restaurant_tables')
    .select('id, display_name')
    .eq('restaurant_id', rid)
    .eq('id', tableId)
    .is('deleted_at', null)
    .maybeSingle();

  if (tableErr || !tableRow) {
    return NextResponse.json({ error: 'table_not_available' }, { status: 400 });
  }

  const displayName = tableRow.display_name as string;

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
    const maxMeters = normalizeOrderRadiusMeters(restaurant.order_radius_meters);
    if (dist > maxMeters && !devBypass) {
      return NextResponse.json({ error: 'location_too_far' }, { status: 403 });
    }
  }

  let { data: session } = await admin
    .from('table_sessions')
    .select('id, status')
    .eq('restaurant_id', rid)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!staffWaiter) {
    if (!session?.id) {
      return NextResponse.json({ error: 'buffet_required' }, { status: 403 });
    }
    if (session.status === 'billing') {
      return NextResponse.json({ error: 'session_billing' }, { status: 409 });
    }
    const { data: sessionOrders, error: buffetCheckErr } = await admin
      .from('orders')
      .select('*')
      .eq('restaurant_id', rid)
      .eq('session_id', session.id)
      .in('status', ['pending', 'cooking', 'done']);
    if (buffetCheckErr) {
      return NextResponse.json({ error: 'order_query_failed' }, { status: 500 });
    }
    if (!guestOrderingEnabled(session, (sessionOrders || []) as Order[])) {
      return NextResponse.json({ error: 'buffet_required' }, { status: 403 });
    }
  } else {
    if (!session?.id) {
      const { data: created, error: csErr } = await admin
        .from('table_sessions')
        .insert({
          restaurant_id: rid,
          table_id: tableId,
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
  }

  const sessionId = session!.id as string;

  let resolved;
  try {
    resolved = await resolveAppendCartItems({
      admin,
      restaurantId: rid,
      rawItems: body.items,
    });
  } catch {
    return NextResponse.json({ error: 'menu_items_query_failed' }, { status: 500 });
  }
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const newItems = resolved.items;
  const batchId = resolved.batchId;

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
        table_id: tableId,
        display_name: displayName,
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
