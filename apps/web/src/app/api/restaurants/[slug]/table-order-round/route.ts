import { NextResponse } from 'next/server';
import {
  loadTableOrderRoundContext,
  roundSnapshotJson,
} from '@/lib/table-order-round/request-context';
import { getRoundSnapshot } from '@/lib/table-order-round/service';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const url = new URL(req.url);
  const loaded = await loadTableOrderRoundContext({
    slug: params.slug,
    tableIdRaw: url.searchParams.get('table_id'),
    guestClientIdRaw: url.searchParams.get('guest_client_id'),
    requireGuestClient: false,
  });
  if (!loaded.ok) return loaded.response;

  const snapshot = await getRoundSnapshot({
    admin: loaded.ctx.admin,
    restaurantId: loaded.ctx.restaurant.restaurantId,
    sessionId: loaded.ctx.writeContext.session.id as string,
    sessionOrders: loaded.ctx.writeContext.sessionOrders,
    settings: loaded.ctx.settings,
  });

  return NextResponse.json(roundSnapshotJson(snapshot));
}
