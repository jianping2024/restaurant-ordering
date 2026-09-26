import { NextResponse } from 'next/server';
import { AUDIT_EVENT, loadStaffAuditActor, scheduleRecordAudit } from '@/lib/audit';
import {
  assertCheckoutRequestAllowed,
  resolveCheckoutRequestCaller,
} from '@/lib/checkout-request-auth';
import { ensureStaffCheckoutEntryForTable } from '@/lib/checkout-request-server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerRestaurantForApi } from '@/lib/customer-restaurant-gate';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export const runtime = 'nodejs';

/**
 * Staff floor「呼叫结账」: reopen active preserved split or mint whole_table.
 * Guest QR checkout stays on POST …/checkout/request.
 */
export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const auth = await assertCheckoutRequestAllowed(slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const caller = await resolveCheckoutRequestCaller(slug);
  if (caller.kind !== 'authorized_staff') {
    return NextResponse.json({ error: 'staff_only' }, { status: 403 });
  }

  let body: { table_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableId = parseTableIdParam(body.table_id);
  if (!tableId) {
    return NextResponse.json({ error: 'invalid_table_id' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const loaded = await loadCustomerRestaurantForApi(admin, slug);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const submitResult = await ensureStaffCheckoutEntryForTable(
    admin,
    loaded.restaurant.id,
    tableId,
  );

  if (!submitResult.ok) {
    return NextResponse.json(
      { error: submitResult.error, message: submitResult.message },
      { status: submitResult.status },
    );
  }

  const { staffSessionForSlug } = await import('@/lib/staff-api-auth');
  const staffCtx = await staffSessionForSlug(slug);
  if (staffCtx) {
    const actor = await loadStaffAuditActor(admin, {
      restaurantId: loaded.restaurant.id,
      userId: staffCtx.user_id,
      role: staffCtx.role,
    });
    scheduleRecordAudit(admin, AUDIT_EVENT.CHECKOUT_REQUESTED, {
      restaurantId: loaded.restaurant.id,
      actor,
      context: {
        billSplitId: submitResult.bill_split_id,
        sessionId: submitResult.session_id,
        tableName: submitResult.table_name || '—',
        splitMode: submitResult.split_mode,
        totalAmount: submitResult.total_amount,
        ensureEntry: true,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    bill_split_id: submitResult.bill_split_id,
    result: submitResult.result,
    total_amount: submitResult.total_amount,
    split_mode: submitResult.split_mode,
  });
}
