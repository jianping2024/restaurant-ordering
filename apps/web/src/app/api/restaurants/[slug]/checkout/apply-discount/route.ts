import { NextResponse } from 'next/server';
import { checkoutErrorResponse } from '@/lib/checkout-error-response';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import { applyBillSplitDiscount } from '@/lib/checkout-discount/apply-bill-split-discount';

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
    discount_rate?: unknown;
    discount_reason?: unknown;
    discount_reason_detail?: unknown;
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

  const discountRate =
    typeof body.discount_rate === 'number' && Number.isFinite(body.discount_rate)
      ? body.discount_rate
      : 0;

  const discountReason =
    typeof body.discount_reason === 'string' ? body.discount_reason : null;
  const discountReasonDetail =
    typeof body.discount_reason_detail === 'string' ? body.discount_reason_detail : null;

  const auth = await authorizeCheckoutConfirmPayment(slug, req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await applyBillSplitDiscount({
    admin: auth.admin,
    restaurantId: auth.restaurantId,
    billSplitId,
    discountRate,
    discountReason,
    discountReasonDetail,
    actor: auth.actor,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    discount_rate: result.discount_rate,
    discount_reason: result.discount_reason,
    discount_reason_detail: result.discount_reason_detail,
  });
}
