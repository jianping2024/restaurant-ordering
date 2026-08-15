import { NextResponse } from 'next/server';
import { getDashboardOperationalContext } from '@/lib/dashboard-access-cached';
import {
  loadOrderHistoryEntries,
  OrderHistoryLoadError,
} from '@/lib/order-history/load-entries';
import { parseOrderHistorySearchParams } from '@/lib/order-history/parse-query';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const ctx = await getDashboardOperationalContext('dashboard.orders.view');
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

  const { offset, limit, filters } = parseOrderHistorySearchParams(
    new URL(req.url).searchParams,
  );
  try {
    const result = await loadOrderHistoryEntries(ctx.admin, {
      restaurantId: restaurant.id as string,
      ownerId: restaurant.owner_id as string,
      restaurantName: restaurant.name as string,
      offset,
      limit,
      ...filters,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OrderHistoryLoadError) {
      console.error('[order-history]', err.message);
      return NextResponse.json({ error: err.code }, { status: 500 });
    }
    throw err;
  }
}
