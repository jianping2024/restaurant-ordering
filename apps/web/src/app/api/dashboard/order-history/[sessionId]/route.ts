import { NextResponse } from 'next/server';
import { loadFrontdeskOperationalContext } from '@/lib/dashboard-access';
import { loadOrderHistoryDetail } from '@/lib/order-history/load-detail';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } },
) {
  const sessionId = params.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: 'missing_session_id' }, { status: 400 });
  }

  const ctx = await loadFrontdeskOperationalContext();
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { data: restaurant, error: restaurantError } = await ctx.admin
    .from('restaurants')
    .select('id, name, owner_id')
    .eq('id', ctx.restaurantId)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
  }

  const result = await loadOrderHistoryDetail(ctx.admin, {
    restaurantId: restaurant.id as string,
    ownerId: restaurant.owner_id as string,
    restaurantName: restaurant.name as string,
    sessionId,
  });

  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result.detail);
}
