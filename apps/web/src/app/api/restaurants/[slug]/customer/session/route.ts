import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loadCustomerRestaurantForApi,
  loadCustomerSessionOrders,
  resolveCustomerTableContext,
} from '@/lib/customer-session-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const loaded = await loadCustomerRestaurantForApi(admin, slug);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }
  const restaurant = loaded.restaurant;

  const { searchParams } = new URL(req.url);
  const ctx = await resolveCustomerTableContext({
    admin,
    restaurantId: restaurant.id,
    tableIdParam: searchParams.get('table_id'),
  });
  if (!ctx) {
    return NextResponse.json({ error: 'table_not_available' }, { status: 404 });
  }

  const orders = ctx.activeSession?.id
    ? await loadCustomerSessionOrders({
        admin,
        restaurantId: restaurant.id,
        sessionId: ctx.activeSession.id,
        ascending: false,
        limit: 20,
      })
    : [];

  return NextResponse.json({
    table_id: ctx.tableId,
    display_name: ctx.displayName,
    active_session: ctx.activeSession,
    recent_orders: orders,
  });
}
