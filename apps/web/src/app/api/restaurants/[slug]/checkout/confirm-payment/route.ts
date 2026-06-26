import { NextResponse } from 'next/server';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import { confirmBillSplitPayment } from '@/lib/checkout-confirm-payment';
import { resolveReceiptPrinterId } from '@/lib/restaurant-receipt-printers-server';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  let body: {
    bill_split_id?: unknown;
    person_index?: unknown;
    discount_rate?: unknown;
    discount_reason?: unknown;
    discount_reason_detail?: unknown;
    receipt_printer_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const billSplitId = typeof body.bill_split_id === 'string' ? body.bill_split_id.trim() : '';
  if (!billSplitId) {
    return NextResponse.json({ error: 'missing_bill_split_id' }, { status: 400 });
  }

  const personIndex =
    typeof body.person_index === 'number' && Number.isInteger(body.person_index)
      ? body.person_index
      : 0;

  const discountRate =
    typeof body.discount_rate === 'number' && Number.isFinite(body.discount_rate)
      ? body.discount_rate
      : 0;

  const discountReason =
    typeof body.discount_reason === 'string' ? body.discount_reason : null;
  const discountReasonDetail =
    typeof body.discount_reason_detail === 'string' ? body.discount_reason_detail : null;

  const receiptPrinterIdRaw =
    typeof body.receipt_printer_id === 'string' ? body.receipt_printer_id.trim() : '';

  const auth = await authorizeCheckoutConfirmPayment(slug, req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const receiptPrinterId = await resolveReceiptPrinterId(
    auth.admin,
    auth.restaurantId,
    receiptPrinterIdRaw || undefined,
    auth.printLocale,
  );
  if (receiptPrinterIdRaw && !receiptPrinterId) {
    return NextResponse.json({ error: 'invalid_receipt_printer' }, { status: 400 });
  }

  const result = await confirmBillSplitPayment({
    admin: auth.admin,
    restaurantId: auth.restaurantId,
    printLocale: auth.printLocale,
    billSplitId,
    personIndex,
    discountRate,
    discountReason,
    discountReasonDetail,
    actor: auth.actor,
    receiptPrinterId: receiptPrinterId ?? undefined,
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
  });
}
