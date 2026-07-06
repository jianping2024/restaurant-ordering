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
    collected_amount?: unknown;
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

  const collectedAmount =
    typeof body.collected_amount === 'number' && Number.isFinite(body.collected_amount)
      ? body.collected_amount
      : undefined;

  const receiptPrinterIdRaw =
    typeof body.receipt_printer_id === 'string' ? body.receipt_printer_id.trim() : '';

  const auth = await authorizeCheckoutConfirmPayment(slug, req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let receiptPrinterId: string | undefined;
  if (auth.billReceiptPrintEnabled) {
    const resolved = await resolveReceiptPrinterId(
      auth.admin,
      auth.restaurantId,
      receiptPrinterIdRaw || undefined,
      auth.printLocale,
    );
    if (receiptPrinterIdRaw && !resolved) {
      return NextResponse.json({ error: 'invalid_receipt_printer' }, { status: 400 });
    }
    receiptPrinterId = resolved;
  }

  const result = await confirmBillSplitPayment({
    admin: auth.admin,
    restaurantId: auth.restaurantId,
    printLocale: auth.printLocale,
    billSplitId,
    personIndex,
    collectedAmount,
    createdByUserId: auth.actor.userId,
    receiptPrinterId,
    billReceiptPrintEnabled: auth.billReceiptPrintEnabled,
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
