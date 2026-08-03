import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerRestaurantForApi } from '@/lib/customer-restaurant-gate';
import { CUSTOMER_READ_NO_STORE_HEADERS } from '@/lib/customer-read-http-headers';
import {
  loadCustomerSessionContext,
  parseCustomerSessionScope,
} from '@/lib/customer-session-context';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400, headers: CUSTOMER_READ_NO_STORE_HEADERS });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: 'server_misconfigured' },
      { status: 503, headers: CUSTOMER_READ_NO_STORE_HEADERS },
    );
  }

  const loaded = await loadCustomerRestaurantForApi(admin, slug);
  if (!loaded.ok) {
    return NextResponse.json(
      { error: loaded.error },
      { status: loaded.status, headers: CUSTOMER_READ_NO_STORE_HEADERS },
    );
  }
  const restaurant = loaded.restaurant;

  const { searchParams } = new URL(req.url);
  const scope = parseCustomerSessionScope(searchParams.get('scope'));
  const ctx = await loadCustomerSessionContext({
    admin,
    restaurantId: restaurant.id,
    tableIdParam: searchParams.get('table_id'),
    scope,
  });
  if (!ctx) {
    return NextResponse.json(
      { error: 'table_not_available' },
      { status: 404, headers: CUSTOMER_READ_NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(ctx, { headers: CUSTOMER_READ_NO_STORE_HEADERS });
}
