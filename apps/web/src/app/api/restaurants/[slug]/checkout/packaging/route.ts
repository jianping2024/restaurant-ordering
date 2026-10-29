import { NextResponse } from 'next/server';
import { parseAppendClientRequestId } from '@/lib/append-idempotency';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import { checkoutErrorResponse } from '@/lib/checkout-error-response';
import { parsePackagingLines } from '@/lib/checkout-packaging';
import {
  addCheckoutPackagingLines,
  voidCheckoutPackagingLine,
  type CheckoutPackagingResult,
} from '@/lib/checkout-packaging-server';

export const runtime = 'nodejs';

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function respond(result: CheckoutPackagingResult) {
  if (result.ok) return NextResponse.json({ ok: true });
  return NextResponse.json(
    { error: result.error, ...(result.lineKeys ? { line_keys: result.lineKeys } : {}) },
    { status: result.status },
  );
}

/** Add packaging supply lines (menu packaging item + qty) to a takeaway bill session. */
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

  const lines = parsePackagingLines(body);
  if (!lines) {
    return NextResponse.json({ error: 'invalid_lines' }, { status: 400 });
  }

  const auth = await authorizeCheckoutConfirmPayment(slug, req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return respond(
    await addCheckoutPackagingLines({
      admin: auth.admin,
      restaurantId: auth.restaurantId,
      billSplitId,
      lines,
      clientRequestId,
    }),
  );
}

/** Remove one packaging supply line (voided with audit; drops out of the bill). */
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
    await voidCheckoutPackagingLine({
      admin: auth.admin,
      restaurantId: auth.restaurantId,
      billSplitId,
      lineId,
      actor: auth.actor,
    }),
  );
}
