import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerRestaurantForApi } from '@/lib/customer-restaurant-gate';
import { unlockIndividualTickets } from '@/lib/individual-checkout-server';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { parseGuestClientId } from '@/lib/table-order-round/guest-client';

export const runtime = 'nodejs';

/** Guest「恢复点单」: unlock the tickets this phone called (none paid / collected yet). */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug?.trim();
  if (!slug) return NextResponse.json({ error: 'missing_slug' }, { status: 400 });

  let body: { table_id?: unknown; guest_client_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const tableId = parseTableIdParam(body.table_id);
  if (!tableId) return NextResponse.json({ error: 'invalid_table_id' }, { status: 400 });
  const guestClientId = parseGuestClientId(body.guest_client_id);
  if (!guestClientId) {
    return NextResponse.json({ error: 'invalid_guest_client_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }
  const loaded = await loadCustomerRestaurantForApi(admin, slug);
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  const result = await unlockIndividualTickets(admin, {
    restaurantId: loaded.restaurant.id,
    tableId,
    actor: 'guest',
    clientId: guestClientId,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true, bill_split_id: result.bill_split_id });
}
