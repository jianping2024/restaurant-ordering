import { NextResponse } from 'next/server';
import { verifyOrderAppendGate } from '@/lib/order-submit-gate';
import { finalizeRound } from '@/lib/table-order-round/service';
import {
  loadTableOrderRoundContext,
  roundSnapshotJson,
} from '@/lib/table-order-round/request-context';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  let body: {
    table_id?: unknown;
    guest_client_id?: unknown;
    latitude?: unknown;
    longitude?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const loaded = await loadTableOrderRoundContext({
    slug: params.slug,
    tableIdRaw: body.table_id,
    guestClientIdRaw: body.guest_client_id,
    requireGuestClient: true,
  });
  if (!loaded.ok) return loaded.response;
  const { ctx } = loaded;

  const gate = await verifyOrderAppendGate({
    req,
    restaurant: ctx.restaurant,
    waiterFlow: false,
    body,
  });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const result = await finalizeRound({
    admin: ctx.admin,
    restaurantId: ctx.restaurant.restaurantId,
    sessionId: ctx.writeContext.session.id as string,
    tableId: ctx.tableId,
    settings: ctx.settings,
    sessionOrders: ctx.writeContext.sessionOrders,
    buffetServiceMode: ctx.restaurant.buffetServiceMode,
    displayName: ctx.displayName,
    force: false,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ...roundSnapshotJson(result.data.snapshot),
    order_id: result.data.order_id,
    batch_id: result.data.batch_id,
    enqueue_token: result.data.enqueue_token,
    idempotent_replay: result.data.idempotent_replay === true,
  });
}
