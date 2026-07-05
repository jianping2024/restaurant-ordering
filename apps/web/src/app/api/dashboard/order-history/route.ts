import { NextResponse } from 'next/server';
import { loadFrontdeskOperationalContext } from '@/lib/dashboard-access';
import { loadOrderHistoryEntries } from '@/lib/order-history/load-entries';
import { parseOrderHistorySearchParams } from '@/lib/order-history/parse-query';

export const runtime = 'nodejs';

export async function GET(req: Request) {
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

  const { offset, limit, filters } = parseOrderHistorySearchParams(new URL(req.url).searchParams);
  const result = await loadOrderHistoryEntries(ctx.admin, {
    restaurantId: restaurant.id as string,
    ownerId: restaurant.owner_id as string,
    restaurantName: restaurant.name as string,
    offset,
    limit,
    ...filters,
  });

  return NextResponse.json(result);
}
