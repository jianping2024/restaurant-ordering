import { NextResponse } from 'next/server';
import { verifyOrderAppendGate } from '@/lib/order-submit-gate';
import { submitRequest } from '@/lib/table-order-round/service';
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

  const result = await submitRequest({
    admin: ctx.admin,
    restaurantId: ctx.restaurant.restaurantId,
    sessionId: ctx.writeContext.session.id as string,
    guestClientId: ctx.guestClientId!,
    settings: ctx.settings,
    liveGuestCount: ctx.liveGuestCount,
    sessionOrders: ctx.writeContext.sessionOrders,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(roundSnapshotJson(result.data.snapshot));
}
