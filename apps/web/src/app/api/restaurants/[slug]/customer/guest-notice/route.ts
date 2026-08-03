import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CUSTOMER_READ_NO_STORE_HEADERS } from '@/lib/customer-read-http-headers';
import { loadGuestOrderingNotice } from '@/lib/guest-ordering-notice-server';
import { loadCustomerRestaurantForApi } from '@/lib/customer-restaurant-gate';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.json(
      { error: 'missing_slug' },
      { status: 400, headers: CUSTOMER_READ_NO_STORE_HEADERS },
    );
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

  const notice = await loadGuestOrderingNotice(admin, loaded.restaurant.id);
  return NextResponse.json({ notice }, { headers: CUSTOMER_READ_NO_STORE_HEADERS });
}
