import { NextResponse } from 'next/server';
import { checkoutErrorResponse } from '@/lib/checkout-error-response';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import { unlockIndividualTickets } from '@/lib/individual-checkout-server';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export const runtime = 'nodejs';

/**
 * Staff「解锁」: delete an individual-checkout ticket (called, not yet collected); its dishes return to the pool.
 * Replaces whole-table resume-ordering for individual sessions.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug?.trim();
  if (!slug) return checkoutErrorResponse('missing_slug');

  let body: { table_id?: unknown; ticket_keys?: unknown };
  try {
    body = await req.json();
  } catch {
    return checkoutErrorResponse('invalid_json');
  }
  const tableId = parseTableIdParam(body.table_id);
  if (!tableId) return checkoutErrorResponse('invalid_table_id');
  const ticketKeys = Array.isArray(body.ticket_keys)
    ? body.ticket_keys
        .filter((key): key is string => typeof key === 'string')
        .map((key) => key.trim())
        .filter(Boolean)
        .slice(0, 50)
    : [];
  if (ticketKeys.length === 0) {
    return checkoutErrorResponse('missing_ticket_keys');
  }

  const auth = await authorizeCheckoutConfirmPayment(slug, req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await unlockIndividualTickets(auth.admin, {
    restaurantId: auth.restaurantId,
    tableId,
    actor: 'staff',
    ticketKeys,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true, bill_split_id: result.bill_split_id });
}
