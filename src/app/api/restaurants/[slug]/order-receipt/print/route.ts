import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { enqueueReceiptPrint, type ReceiptVariant } from '@/lib/order-receipt-enqueue';

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
    table_number?: unknown;
    session_id?: unknown;
    job_type?: unknown;
    receipt_variant?: unknown;
    amount_paid?: unknown;
    payment_method?: unknown;
    payer_name?: unknown;
    person_amount?: unknown;
    bill_split_id?: unknown;
    person_index?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableNumber = Number(body.table_number);
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 30) {
    return NextResponse.json({ error: 'invalid_table_number' }, { status: 400 });
  }

  const jobTypeRaw = typeof body.job_type === 'string' ? body.job_type.trim() : 'order_receipt';
  const variant = parseVariant(body.receipt_variant, jobTypeRaw);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const waiterCtx = await staffAuthFromRequest(req, slug, 'waiter');
  let restaurantId: string;
  let restaurantName: string | null = null;
  let printLocale: string | null = null;

  if (waiterCtx) {
    restaurantId = waiterCtx.restaurant_id;
    const { data: rest } = await admin
      .from('restaurants')
      .select('name, print_locale')
      .eq('id', restaurantId)
      .single();
    restaurantName = rest?.name ?? null;
    printLocale = rest?.print_locale ?? null;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const { data: rest } = await admin
      .from('restaurants')
      .select('id, name, print_locale')
      .eq('slug', slug)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (!rest) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    restaurantId = rest.id;
    restaurantName = rest.name;
    printLocale = rest.print_locale;
  }

  let sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : '';
  if (!sessionId) {
    const { data: session } = await admin
      .from('table_sessions')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('table_number', tableNumber)
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

  const result = await enqueueReceiptPrint({
    admin,
    restaurantId,
    restaurantName,
    printLocale,
    sessionId,
    tableNumber,
    variant,
    payerName,
    personAmount,
    billSplitId,
    personIndex,
    amountPaid: amountPaid ?? personAmount,
    paymentMethod,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: result.status });
  }

  return NextResponse.json({ ok: true, job_id: result.job_id });
}
