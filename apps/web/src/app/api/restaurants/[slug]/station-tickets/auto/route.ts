import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerRestaurantForApi } from '@/lib/customer-session-context';
import { orderItemBatchKey } from '@/lib/order-items';
import { enqueueStationTicketsForOrder } from '@/lib/station-ticket-enqueue';
import { autoEnqueueRateLimitCheck } from '@/lib/station-ticket-auto-rate-limit';
import { orderEnqueueSecret, verifyOrderEnqueueToken } from '@/lib/order-enqueue-token';
import { clientIpFromRequest } from '@/lib/request-client-ip';

export const runtime = 'nodejs';

/** Enqueue station tickets for a batch right after guest/waiter order submit (no staff password). */
export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const enqueueSecret = orderEnqueueSecret();
  if (!enqueueSecret) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  let body: { order_id?: string; batch_id?: string; enqueue_token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
  const batchId = typeof body.batch_id === 'string' ? body.batch_id.trim() : '';
  const enqueueToken = typeof body.enqueue_token === 'string' ? body.enqueue_token.trim() : '';

  if (!orderId || !batchId || !enqueueToken) {
    return NextResponse.json({ error: 'order_id_batch_id_and_token_required' }, { status: 400 });
  }

  const loaded = await loadCustomerRestaurantForApi(admin, slug);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const { data: restaurant, error: rErr } = await admin
    .from('restaurants')
    .select('name, print_locale')
    .eq('id', loaded.restaurant.id)
    .maybeSingle();

  if (rErr || !restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
  }

  if (
    !verifyOrderEnqueueToken(enqueueToken, enqueueSecret, {
      restaurant_id: loaded.restaurant.id,
      order_id: orderId,
      batch_id: batchId,
    })
  ) {
    return NextResponse.json({ error: 'invalid_enqueue_token' }, { status: 403 });
  }

  const { data: order, error: oErr } = await admin
    .from('orders')
    .select('id, restaurant_id, items')
    .eq('id', orderId)
    .maybeSingle();

  if (oErr || !order || order.restaurant_id !== loaded.restaurant.id) {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
  }

  const items = (order.items || []) as Array<{ batch_id?: string }>;
  const batchKnown = items.some((item) => orderItemBatchKey(item) === batchId);
  if (!batchKnown) {
    return NextResponse.json({ error: 'unknown_batch' }, { status: 400 });
  }

  const rl = autoEnqueueRateLimitCheck(
    clientIpFromRequest(req),
    loaded.restaurant.id,
    orderId,
    batchId,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  const result = await enqueueStationTicketsForOrder({
    admin,
    restaurant: {
      id: loaded.restaurant.id,
      name: restaurant.name ?? null,
      print_locale: restaurant.print_locale ?? null,
    },
    orderId,
    batchId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    batch_id: result.batch_id,
    inserted: result.inserted,
    skipped_duplicates: result.skipped_duplicates,
    station_names: result.station_names,
  });
}
