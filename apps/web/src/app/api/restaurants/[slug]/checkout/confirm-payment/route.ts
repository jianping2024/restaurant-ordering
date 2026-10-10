import { NextResponse } from 'next/server';
import { checkoutErrorResponse } from '@/lib/checkout-error-response';
import { parseAppendClientRequestId } from '@/lib/append-idempotency';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import {
  confirmBillSplitPayment,
  shouldHoldCheckoutSessionOpen,
} from '@/lib/checkout-confirm-payment';
import {
  parseBillSyncPaymentLines,
  parseBillSyncPaymentMethod,
  validatePaymentLinesForMethod,
} from '@/lib/bill-sync-payload';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.trim();
  if (!slug) {
    return checkoutErrorResponse('missing_slug');
  }

  let body: {
    bill_split_id?: unknown;
    person_index?: unknown;
    collected_amount?: unknown;
    payment_method?: unknown;
    payment_lines?: unknown;
    client_request_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return checkoutErrorResponse('invalid_json');
  }

  const billSplitId = typeof body.bill_split_id === 'string' ? body.bill_split_id.trim() : '';
  if (!billSplitId) {
    return checkoutErrorResponse('missing_bill_split_id');
  }

  const clientRequestId = parseAppendClientRequestId(body.client_request_id);
  if (!clientRequestId) {
    return checkoutErrorResponse('invalid_client_request_id');
  }

  const personIndex =
    typeof body.person_index === 'number' && Number.isInteger(body.person_index)
      ? body.person_index
      : 0;

  const collectedAmount =
    typeof body.collected_amount === 'number' && Number.isFinite(body.collected_amount)
      ? body.collected_amount
      : undefined;

  const paymentMethodRaw =
    typeof body.payment_method === 'string' ? body.payment_method.trim() : '';
  if (!paymentMethodRaw) {
    return checkoutErrorResponse('missing_payment_method');
  }
  const paymentMethod = parseBillSyncPaymentMethod(paymentMethodRaw);
  if (!paymentMethod) {
    return checkoutErrorResponse('invalid_payment_method');
  }

  const paymentLines =
    body.payment_lines === undefined || body.payment_lines === null
      ? null
      : parseBillSyncPaymentLines(body.payment_lines);
  if (body.payment_lines != null && paymentLines === null) {
    return checkoutErrorResponse('invalid_payment_lines');
  }
  const linesErr = validatePaymentLinesForMethod(
    paymentMethod,
    paymentLines,
    collectedAmount ?? 0,
  );
  if (linesErr) {
    return NextResponse.json({ error: linesErr }, { status: 400 });
  }

  const auth = await authorizeCheckoutConfirmPayment(slug, req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const holdSessionOpen = await shouldHoldCheckoutSessionOpen({
    admin: auth.admin,
    restaurantId: auth.restaurantId,
    billSplitId,
    personIndex,
  });

  const result = await confirmBillSplitPayment({
    admin: auth.admin,
    restaurantId: auth.restaurantId,
    billSplitId,
    personIndex,
    paymentMethod,
    paymentLines,
    collectedAmount,
    clientRequestId,
    createdByUserId: auth.actor.userId,
    actor: auth.actor,
    holdSessionOpen,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    all_paid: result.all_paid,
    result: result.result,
    final_amount: result.final_amount,
    collection: result.collection,
  });
}
