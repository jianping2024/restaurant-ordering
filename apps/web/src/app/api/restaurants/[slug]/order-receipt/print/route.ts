import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import { clampCheckoutDiscountRate } from '@/lib/checkout-split-math';
import { enqueueReceiptPrint, type ReceiptVariant } from '@/lib/order-receipt-enqueue';
import { resolveReceiptPrinterId } from '@/lib/restaurant-receipt-printers-server';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export const runtime = 'nodejs';

function parseVariant(raw: unknown, jobTypeFallback: string): ReceiptVariant {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (v === 'pre_bill' || v === 'checkout_bill' || v === 'split_payment' || v === 'final') {
    return v;
  }
  if (jobTypeFallback === 'pre_bill') return 'pre_bill';
  return 'final';
}

/** Guest session path for customer pre-bill after call-for-bill. */
async function authorizeCustomerPreBill(
  slug: string,
  tableId: string,
  sessionId: string,
): Promise<
  | { ok: true; admin: ReturnType<typeof createAdminClient>; restaurantId: string; printLocale: string | null }
  | { ok: false; error: string; status: number }
> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'server_misconfigured', status: 503 };
  }

  const { data: rest } = await admin
    .from('restaurants')
    .select('id, print_locale')
    .eq('slug', slug)
    .maybeSingle();
  if (!rest?.id) {
    return { ok: false, error: 'restaurant_not_found', status: 404 };
  }

  const { data: session } = await admin
    .from('table_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('restaurant_id', rest.id)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .maybeSingle();
  if (!session?.id) {
    return { ok: false, error: 'invalid_session', status: 403 };
  }

  return {
    ok: true,
    admin,
    restaurantId: rest.id as string,
    printLocale: (rest.print_locale as string | null) ?? null,
  };
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  let body: {
    table_id?: unknown;
    session_id?: unknown;
    job_type?: unknown;
    receipt_variant?: unknown;
    amount_paid?: unknown;
    payment_method?: unknown;
    payer_name?: unknown;
    person_amount?: unknown;
    bill_split_id?: unknown;
    person_index?: unknown;
    receipt_printer_id?: unknown;
    discount_rate?: unknown;
    collected_payment_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableId = parseTableIdParam(body.table_id);
  if (!tableId) {
    return NextResponse.json({ error: 'invalid_table_id' }, { status: 400 });
  }

  const jobTypeRaw = typeof body.job_type === 'string' ? body.job_type.trim() : 'order_receipt';
  const variant = parseVariant(body.receipt_variant, jobTypeRaw);
  const sessionIdRaw = typeof body.session_id === 'string' ? body.session_id.trim() : '';

  const checkoutAuth = await authorizeCheckoutConfirmPayment(slug, req);
  let admin: ReturnType<typeof createAdminClient>;
  let restaurantId: string;
  let printLocale: string | null;

  if ('admin' in checkoutAuth) {
    admin = checkoutAuth.admin;
    restaurantId = checkoutAuth.restaurantId;
    printLocale = checkoutAuth.printLocale;
  } else if (variant === 'pre_bill' && sessionIdRaw) {
    const guestAuth = await authorizeCustomerPreBill(slug, tableId, sessionIdRaw);
    if (!guestAuth.ok) {
      return NextResponse.json({ error: guestAuth.error }, { status: guestAuth.status });
    }
    admin = guestAuth.admin;
    restaurantId = guestAuth.restaurantId;
    printLocale = guestAuth.printLocale;
  } else {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: tableRow } = await admin
    .from('restaurant_tables')
    .select('id, display_name')
    .eq('restaurant_id', restaurantId)
    .eq('id', tableId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!tableRow) {
    return NextResponse.json({ error: 'table_not_available' }, { status: 400 });
  }

  const tableDisplayName = tableRow.display_name as string;

  let sessionId = sessionIdRaw;
  if (!sessionId) {
    const { data: session } = await admin
      .from('table_sessions')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('table_id', tableId)
      .in('status', ['open', 'billing'])
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!session?.id) {
      return NextResponse.json({ error: 'no_active_session' }, { status: 404 });
    }
    sessionId = session.id;
  }

  const amountPaid =
    typeof body.amount_paid === 'number' && Number.isFinite(body.amount_paid)
      ? body.amount_paid
      : undefined;
  const personAmount =
    typeof body.person_amount === 'number' && Number.isFinite(body.person_amount)
      ? body.person_amount
      : undefined;
  const paymentMethod =
    typeof body.payment_method === 'string' ? body.payment_method.trim() : undefined;
  const payerName = typeof body.payer_name === 'string' ? body.payer_name.trim() : undefined;
  const billSplitId =
    typeof body.bill_split_id === 'string' ? body.bill_split_id.trim() : undefined;
  const personIndex =
    typeof body.person_index === 'number' && Number.isInteger(body.person_index)
      ? body.person_index
      : undefined;
  const discountRate =
    typeof body.discount_rate === 'number' && Number.isFinite(body.discount_rate)
      ? clampCheckoutDiscountRate(body.discount_rate)
      : 0;
  const collectedPaymentId =
    typeof body.collected_payment_id === 'string' ? body.collected_payment_id.trim() : undefined;

  const receiptPrinterIdRaw =
    typeof body.receipt_printer_id === 'string' ? body.receipt_printer_id.trim() : '';
  const receiptPrinterId = await resolveReceiptPrinterId(
    admin,
    restaurantId,
    receiptPrinterIdRaw || undefined,
    printLocale,
  );
  if (receiptPrinterIdRaw && !receiptPrinterId) {
    return NextResponse.json({ error: 'invalid_receipt_printer' }, { status: 400 });
  }

  // Intent, not identity: pre_bill is always automatic (gated by bill_receipt_print).
  // Staff cookies must not promote call-bill pre-bills to ungated staff_manual.
  const printSource =
    variant === 'pre_bill'
      ? ('automatic' as const)
      : 'admin' in checkoutAuth
        ? ('staff_manual' as const)
        : ('automatic' as const);

  const result = await enqueueReceiptPrint({
    admin,
    restaurantId,
    printLocale,
    sessionId,
    tableId,
    tableDisplayName,
    variant,
    payerName,
    personAmount,
    billSplitId,
    personIndex,
    amountPaid: amountPaid ?? personAmount,
    paymentMethod,
    receiptPrinterId,
    discountRate,
    collectedPaymentId,
    printSource,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: result.status });
  }

  if ('skipped' in result) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  return NextResponse.json({
    ok: true,
    job_id: result.job_id,
    ...(result.deduped ? { deduped: true } : {}),
  });
}
