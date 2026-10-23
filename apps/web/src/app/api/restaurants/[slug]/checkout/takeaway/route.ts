import { NextResponse } from 'next/server';
import { parseAppendClientRequestId } from '@/lib/append-idempotency';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import { checkoutErrorResponse } from '@/lib/checkout-error-response';
import { TAKEAWAY_LINES_MAX, parseTakeawayAmount } from '@/lib/checkout-takeaway';
import {
  addCheckoutTakeawayLines,
  voidCheckoutTakeawayLine,
  type CheckoutTakeawayResult,
} from '@/lib/checkout-takeaway-server';

export const runtime = 'nodejs';

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function respond(result: CheckoutTakeawayResult) {
  if (result.ok) return NextResponse.json({ ok: true });
  return NextResponse.json(
    { error: result.error, ...(result.lineKeys ? { line_keys: result.lineKeys } : {}) },
    { status: result.status },
  );
}

/** Add take-away charge lines (cashier amounts, qty 1, fixed name) to the bill's session. */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug?.trim();
  if (!slug) return checkoutErrorResponse('missing_slug');

  const body = await readJson(req);
  if (!body) return checkoutErrorResponse('invalid_json');

  const billSplitId = typeof body.bill_split_id === 'string' ? body.bill_split_id.trim() : '';
  if (!billSplitId) return checkoutErrorResponse('missing_bill_split_id');

  const clientRequestId = parseAppendClientRequestId(body.client_request_id);
  if (!clientRequestId) {
    return NextResponse.json({ error: 'invalid_client_request_id' }, { status: 400 });
  }

  const rawAmounts = Array.isArray(body.amounts) ? body.amounts : [];
  const amounts = rawAmounts.map(parseTakeawayAmount);
  if (
    amounts.length === 0 ||
    amounts.length > TAKEAWAY_LINES_MAX ||
    amounts.some((amount) => amount == null)
  ) {
    return NextResponse.json({ error: 'invalid_amounts' }, { status: 400 });
  }

  const auth = await authorizeCheckoutConfirmPayment(slug, req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return respond(
    await addCheckoutTakeawayLines({
      admin: auth.admin,
      restaurantId: auth.restaurantId,
      billSplitId,
      amounts: amounts as number[],
      clientRequestId,
    }),
  );
}

/** Remove one take-away line (voided with audit; drops out of the bill). */
export async function DELETE(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug?.trim();
  if (!slug) return checkoutErrorResponse('missing_slug');

  const body = await readJson(req);
  if (!body) return checkoutErrorResponse('invalid_json');

  const billSplitId = typeof body.bill_split_id === 'string' ? body.bill_split_id.trim() : '';
  if (!billSplitId) return checkoutErrorResponse('missing_bill_split_id');
  const lineId = typeof body.line_id === 'string' ? body.line_id.trim() : '';
  if (!lineId) return NextResponse.json({ error: 'missing_line_id' }, { status: 400 });

  const auth = await authorizeCheckoutConfirmPayment(slug, req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return respond(
    await voidCheckoutTakeawayLine({
      admin: auth.admin,
      restaurantId: auth.restaurantId,
      billSplitId,
      lineId,
      actor: auth.actor,
    }),
  );
}
