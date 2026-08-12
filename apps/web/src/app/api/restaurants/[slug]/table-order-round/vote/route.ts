import { NextResponse } from 'next/server';
import {
  loadTableOrderRoundContext,
  roundSnapshotJson,
} from '@/lib/table-order-round/request-context';
import { castVote } from '@/lib/table-order-round/service';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  let body: {
    table_id?: unknown;
    guest_client_id?: unknown;
    vote?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const vote = body.vote === 'confirm' || body.vote === 'defer' ? body.vote : null;
  if (!vote) {
    return NextResponse.json({ error: 'invalid_vote' }, { status: 400 });
  }

  const loaded = await loadTableOrderRoundContext({
    slug: params.slug,
    tableIdRaw: body.table_id,
    guestClientIdRaw: body.guest_client_id,
    requireGuestClient: true,
  });
  if (!loaded.ok) return loaded.response;
  const { ctx } = loaded;

  const result = await castVote({
    admin: ctx.admin,
    restaurantId: ctx.restaurant.restaurantId,
    sessionId: ctx.writeContext.session.id as string,
    guestClientId: ctx.guestClientId!,
    vote,
    settings: ctx.settings,
    liveGuestCount: ctx.liveGuestCount,
    sessionOrders: ctx.writeContext.sessionOrders,
    buffetServiceMode: ctx.restaurant.buffetServiceMode,
    displayName: ctx.displayName,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ...roundSnapshotJson(result.data.snapshot),
    finalized: result.data.finalized === true,
    deferred: result.data.deferred === true,
    enqueue_token: result.data.enqueue_token,
    order_id: result.data.order_id,
  });
}
