import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loadCustomerRestaurantForApi,
  loadCustomerSessionContext,
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

  const loaded = await loadCustomerRestaurantForApi(admin, slug);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }
  const restaurant = loaded.restaurant;

  const { searchParams } = new URL(req.url);
  const ctx = await loadCustomerSessionContext({
    admin,
    restaurantId: restaurant.id,
    tableIdParam: searchParams.get('table_id'),
  });
  if (!ctx) {
    return NextResponse.json({ error: 'table_not_available' }, { status: 404 });
  }

  return NextResponse.json(ctx);
}
