import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { orderEnqueueSecret, signOrderEnqueueToken } from '@/lib/order-enqueue-token';
import { orderAppendRateLimitCheck } from '@/lib/order-append-rate-limit';
import { clientIpFromRequest } from '@/lib/request-client-ip';
import { resolveAppendCartItems } from '@/lib/resolve-append-cart-items';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { checkOrderAppendCooldown } from '@/lib/order-append-cooldown';
import { resolveOrderRestaurant } from '@/lib/order-restaurant-context';
import { verifyOrderAppendGate } from '@/lib/order-submit-gate';
import { loadAppendWriteContext } from '@/lib/append-write-context';
import { writeAppendBatch } from '@/lib/append-write-batch';

export const runtime = 'nodejs';

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

  const waiterFlow = body.waiter_flow === true;
  const resolvedRestaurant = await resolveOrderRestaurant(
    admin,
    slug,
    waiterFlow ? 'staff' : 'guest',
  );
  if (!resolvedRestaurant.ok) {
    return NextResponse.json(
      { error: resolvedRestaurant.error },
      { status: resolvedRestaurant.status },
    );
  }
  const restaurant = resolvedRestaurant.restaurant;
  const rid = restaurant.restaurantId;

  const gate = await verifyOrderAppendGate({
    req,
    restaurant,
    waiterFlow,
    body,
  });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

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

  const writeContext = await loadAppendWriteContext(admin, rid, tableId);
  if (!writeContext.ok) {
    return NextResponse.json({ error: writeContext.error }, { status: writeContext.status });
  }
  const { context } = writeContext;
  const sessionId = context.session.id as string;
  const displayName = tableRow.display_name as string;

  const cooldownCheck = checkOrderAppendCooldown({
    nowMs: Date.now(),
    cooldownSeconds: resolvedRestaurant.restaurant.orderCooldownSeconds,
    sessionOrders: context.sessionOrders,
  });
  if (!cooldownCheck.ok) {
    return NextResponse.json(
      { error: 'order_cooldown_limited' },
      {
        status: 429,
        headers: { 'Retry-After': String(cooldownCheck.retryAfterSec) },
      },
    );
  }

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

  const writeResult = await writeAppendBatch({
    admin,
    restaurantId: rid,
    tableId,
    displayName,
    sessionId,
    context,
    newItems: resolved.items,
  });
  if (!writeResult.ok) {
    return NextResponse.json({ error: writeResult.error }, { status: writeResult.status });
  }

  const enqueue_token = signOrderEnqueueToken(
    { restaurant_id: rid, order_id: writeResult.orderId, batch_id: resolved.batchId },
    secret,
  );

  return NextResponse.json({
    ok: true,
    order_id: writeResult.orderId,
    batch_id: resolved.batchId,
    session_id: sessionId,
    enqueue_token,
    had_done_before: writeResult.hadDoneBefore,
    is_first_order: writeResult.isFirstOrder,
  });
}
