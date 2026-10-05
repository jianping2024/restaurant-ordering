import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CUSTOMER_READ_NO_STORE_HEADERS } from '@/lib/customer-read-http-headers';
import { loadCustomerRestaurantForApi } from '@/lib/customer-restaurant-gate';
import { guestPhoneHoldsOrdering } from '@/lib/individual-checkout-server';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { parseGuestClientId } from '@/lib/table-order-round/guest-client';

export const runtime = 'nodejs';

/**
 * Menu-page ordering hold: does this phone have a called, unpaid ticket in an individual-checkout
 * session? Thin read (no bill payload). The write endpoints enforce the same rule server-side.
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.json(
      { error: 'missing_slug' },
      { status: 400, headers: CUSTOMER_READ_NO_STORE_HEADERS },
    );
  }
  const { searchParams } = new URL(req.url);
  const tableId = parseTableIdParam(searchParams.get('table_id'));
  const guestClientId = parseGuestClientId(searchParams.get('guest_client_id'));
  if (!tableId || !guestClientId) {
    return NextResponse.json(
      { error: 'invalid_request' },
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

  const { data: session } = await admin
    .from('table_sessions')
    .select('id, individual_checkout')
    .eq('restaurant_id', loaded.restaurant.id)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session?.id || session.individual_checkout !== true) {
    return NextResponse.json(
      { individual: false, hold: false },
      { headers: CUSTOMER_READ_NO_STORE_HEADERS },
    );
  }
  const hold = await guestPhoneHoldsOrdering(admin, {
    restaurantId: loaded.restaurant.id,
    sessionId: session.id as string,
    clientId: guestClientId,
  });
  return NextResponse.json(
    { individual: true, hold },
    { headers: CUSTOMER_READ_NO_STORE_HEADERS },
  );
}
