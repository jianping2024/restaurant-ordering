import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { staffAuthFromRequestWithRoles } from '@/lib/staff-api-auth';
import { confirmBillSplitPayment } from '@/lib/checkout-confirm-payment';
import {
  assertReceiptPrinterIdAllowed,
  loadRestaurantReceiptPrinterSnapshot,
} from '@/lib/restaurant-receipt-printers-server';

export const runtime = 'nodejs';

async function authorizeRestaurant(slug: string, req: Request) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: NextResponse.json({ error: 'server_misconfigured' }, { status: 503 }) };
  }

  const staffCtx = await staffAuthFromRequestWithRoles(req, slug, ['waiter', 'cashier']);
  if (staffCtx) {
    const { data: rest } = await admin
      .from('restaurants')
      .select('name, print_locale')
      .eq('id', staffCtx.restaurant_id)
      .single();
    return {
      admin,
      restaurantId: staffCtx.restaurant_id,
      restaurantName: rest?.name ?? null,
      printLocale: rest?.print_locale ?? null,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }

  const { data: rest } = await admin
    .from('restaurants')
    .select('id, name, print_locale')
    .eq('slug', slug)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!rest) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }

  return {
    admin,
    restaurantId: rest.id as string,
    restaurantName: rest.name as string | null,
    printLocale: rest.print_locale as string | null,
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
    bill_split_id?: unknown;
    person_index?: unknown;
    discount_rate?: unknown;
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

  const receiptPrinterIdRaw =
    typeof body.receipt_printer_id === 'string' ? body.receipt_printer_id.trim() : '';

  const auth = await authorizeRestaurant(slug, req);
  if ('error' in auth && auth.error) return auth.error;

  const snapshot = await loadRestaurantReceiptPrinterSnapshot(auth.admin, auth.restaurantId);
  let receiptPrinterId: string | undefined;
  if (receiptPrinterIdRaw) {
    const allowed = assertReceiptPrinterIdAllowed(receiptPrinterIdRaw, snapshot);
    if (!allowed) {
      return NextResponse.json({ error: 'invalid_receipt_printer' }, { status: 400 });
    }
    receiptPrinterId = allowed;
  }

  const result = await confirmBillSplitPayment({
    admin: auth.admin,
    restaurantId: auth.restaurantId,
    restaurantName: auth.restaurantName,
    printLocale: auth.printLocale,
    billSplitId,
    personIndex,
    discountRate,
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
