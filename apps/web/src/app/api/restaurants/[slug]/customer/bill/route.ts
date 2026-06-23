import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loadCustomerExistingSplit,
  loadCustomerRestaurant,
  loadCustomerSessionOrders,
  resolveCustomerTableContext,
} from '@/lib/customer-session-context';

export const runtime = 'nodejs';

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

  const restaurant = await loadCustomerRestaurant(admin, slug);
  if (!restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const ctx = await resolveCustomerTableContext({
    admin,
    restaurantId: restaurant.id,
    tableIdParam: searchParams.get('table_id'),
  });
  if (!ctx) {
    return NextResponse.json({ error: 'table_not_available' }, { status: 404 });
  }
  if (!ctx.activeSession?.id) {
    return NextResponse.json({
      table_id: ctx.tableId,
      display_name: ctx.displayName,
      active_session: null,
      orders: [],
      existing_split: null,
    });
  }

  const [orders, existingSplit] = await Promise.all([
    loadCustomerSessionOrders({
      admin,
      restaurantId: restaurant.id,
      sessionId: ctx.activeSession.id,
      ascending: true,
    }),
    loadCustomerExistingSplit({ admin, sessionId: ctx.activeSession.id }),
  ]);

  return NextResponse.json({
    table_id: ctx.tableId,
    display_name: ctx.displayName,
    active_session: ctx.activeSession,
    orders,
    existing_split: existingSplit,
  });
}
