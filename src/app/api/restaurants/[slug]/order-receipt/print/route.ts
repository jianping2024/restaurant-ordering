import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { enqueueReceiptPrint, type ReceiptVariant } from '@/lib/order-receipt-enqueue';
import {
  resolveReceiptPrinterId,
} from '@/lib/restaurant-receipt-printers-server';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export const runtime = 'nodejs';

function parseVariant(raw: unknown, jobTypeFallback: string): ReceiptVariant {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (v === 'pre_bill' || v === 'split_payment' || v === 'final') return v;
  if (jobTypeFallback === 'pre_bill') return 'pre_bill';
  return 'final';
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

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const waiterCtx = await staffAuthFromRequest(req, slug, 'waiter');
  let restaurantId: string;
  let printLocale: string | null = null;

  if (waiterCtx) {
    restaurantId = waiterCtx.restaurant_id;
    const { data: rest } = await admin
      .from('restaurants')
      .select('print_locale')
      .eq('id', restaurantId)
      .single();
    printLocale = rest?.print_locale ?? null;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: rest } = await admin
        .from('restaurants')
        .select('id, print_locale')
        .eq('slug', slug)
        .eq('owner_id', user.id)
        .maybeSingle();
      if (!rest) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
      restaurantId = rest.id;
      printLocale = rest.print_locale;
    } else if (variant === 'pre_bill' && sessionIdRaw) {
      const { data: rest } = await admin
        .from('restaurants')
        .select('id, print_locale')
        .eq('slug', slug)
        .maybeSingle();
      if (!rest?.id) {
        return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
      }
      const { data: session } = await admin
        .from('table_sessions')
        .select('id')
        .eq('id', sessionIdRaw)
        .eq('restaurant_id', rest.id)
        .eq('table_id', tableId)
        .in('status', ['open', 'billing'])
        .maybeSingle();
      if (!session?.id) {
        return NextResponse.json({ error: 'invalid_session' }, { status: 403 });
      }
      restaurantId = rest.id;
      printLocale = rest.print_locale;
    } else {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
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
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: result.status });
  }

  return NextResponse.json({ ok: true, job_id: result.job_id });
}
