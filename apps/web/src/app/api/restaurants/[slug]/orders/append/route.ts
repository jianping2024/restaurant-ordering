import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { orderEnqueueSecret, signOrderEnqueueToken } from '@/lib/order-enqueue-token';
import { orderAppendRateLimitCheck } from '@/lib/order-append-rate-limit';
import { clientIpFromRequest } from '@/lib/request-client-ip';
import { resolveAppendCartItems } from '@/lib/resolve-append-cart-items';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { resolveOrderRestaurant } from '@/lib/order-restaurant-context';
import { verifyOrderAppendGate } from '@/lib/order-submit-gate';
import { loadAppendWriteContext } from '@/lib/append-write-context';
import { writeAppendBatch } from '@/lib/append-write-batch';
import {
  claimAppendIdempotency,
  completeAppendIdempotency,
  parseAppendClientRequestId,
  releaseAppendIdempotencyClaim,
} from '@/lib/append-idempotency';
import { logJsonConsoleEvent } from '@/lib/json-console-log';

export const runtime = 'nodejs';

/** Guest/waiter order submit: server-side geo fence + signed enqueue token. */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const startedAt = Date.now();
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
    client_request_id?: unknown;
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

  const clientRequestId = parseAppendClientRequestId(body.client_request_id);
  if (!clientRequestId) {
    return NextResponse.json({ error: 'invalid_client_request_id' }, { status: 400 });
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

  const claim = await claimAppendIdempotency({
    admin,
    restaurantId: rid,
    sessionId,
    clientRequestId,
  });

  if (claim.kind === 'error') {
    return NextResponse.json({ error: claim.error }, { status: claim.status });
  }

  if (claim.kind === 'in_progress') {
    logJsonConsoleEvent('order_append', 'append_in_progress', {
      restaurant_id: rid,
      session_id: sessionId,
      table_id: tableId,
      client_request_id: clientRequestId,
      waiter_flow: waiterFlow,
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json({ error: 'append_in_progress' }, { status: 409 });
  }

  if (claim.kind === 'replay') {
    const enqueue_token = signOrderEnqueueToken(
      {
        restaurant_id: rid,
        order_id: claim.result.orderId,
        batch_id: claim.result.batchId,
      },
      secret,
    );
    logJsonConsoleEvent('order_append', 'append_replay', {
      restaurant_id: rid,
      session_id: sessionId,
      table_id: tableId,
      client_request_id: clientRequestId,
      order_id: claim.result.orderId,
      batch_id: claim.result.batchId,
      waiter_flow: waiterFlow,
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json({
      ok: true,
      order_id: claim.result.orderId,
      batch_id: claim.result.batchId,
      session_id: sessionId,
      enqueue_token,
      had_done_before: claim.result.hadDoneBefore,
      is_first_order: claim.result.isFirstOrder,
      idempotent_replay: true,
    });
  }

  let resolved;
  try {
    resolved = await resolveAppendCartItems({
      admin,
      restaurantId: rid,
      rawItems: body.items,
      buffetServiceMode: restaurant.buffetServiceMode,
      staffAssisted: waiterFlow,
      sessionOrders: context.sessionOrders,
    });
  } catch {
    await releaseAppendIdempotencyClaim({ admin, sessionId, clientRequestId });
    return NextResponse.json({ error: 'menu_items_query_failed' }, { status: 500 });
  }
  if (!resolved.ok) {
    await releaseAppendIdempotencyClaim({ admin, sessionId, clientRequestId });
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
    await releaseAppendIdempotencyClaim({ admin, sessionId, clientRequestId });
    return NextResponse.json({ error: writeResult.error }, { status: writeResult.status });
  }

  const completed = await completeAppendIdempotency({
    admin,
    sessionId,
    clientRequestId,
    orderId: writeResult.orderId,
    batchId: resolved.batchId,
    hadDoneBefore: writeResult.hadDoneBefore,
    isFirstOrder: writeResult.isFirstOrder,
    lineCount: resolved.items.length,
  });

  const enqueue_token = signOrderEnqueueToken(
    { restaurant_id: rid, order_id: writeResult.orderId, batch_id: resolved.batchId },
    secret,
  );

  // Items are already persisted — always return success so the client does not retry-write.
  // If complete failed, same-key callers may see in_progress until the row is repaired;
  // never reclaim pending for a second write.
  if (!completed.ok) {
    logJsonConsoleEvent('order_append', 'append_complete_failed', {
      restaurant_id: rid,
      session_id: sessionId,
      table_id: tableId,
      client_request_id: clientRequestId,
      order_id: writeResult.orderId,
      batch_id: resolved.batchId,
      error: completed.error,
      duration_ms: Date.now() - startedAt,
    });
  } else {
    logJsonConsoleEvent('order_append', 'append_written', {
      restaurant_id: rid,
      session_id: sessionId,
      table_id: tableId,
      client_request_id: clientRequestId,
      order_id: writeResult.orderId,
      batch_id: resolved.batchId,
      line_count: resolved.items.length,
      waiter_flow: waiterFlow,
      is_first_order: writeResult.isFirstOrder,
      duration_ms: Date.now() - startedAt,
    });
  }

  return NextResponse.json({
    ok: true,
    order_id: writeResult.orderId,
    batch_id: resolved.batchId,
    session_id: sessionId,
    enqueue_token,
    had_done_before: writeResult.hadDoneBefore,
    is_first_order: writeResult.isFirstOrder,
    idempotent_replay: false,
  });
}
