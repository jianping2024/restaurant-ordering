import { billSyncContentFingerprint } from '@/lib/bill-sync-content-fingerprint';
import type { BillSyncPayload } from '@/lib/bill-sync-payload';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import { enqueueBillSyncJob } from '@/lib/bill-sync-enqueue';
import { loadTableOrdersForSession } from '@/lib/waiter-table-detail-load';
import { distinctMenuItemIdsFromOrders } from '@/lib/menu-item-code';
import { DEFAULT_MENU_VAT_RATE } from '@/lib/menu-vat-rate';
import { isRestaurantFeatureEnabled } from '@mesa/shared';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/restaurants/[slug]/bill-syncs
 * Sole staff enqueue for fiscal bill-sync hang-queue (bill-sync-contract-v1.0).
 */
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
    request_id?: unknown;
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
  const requestId =
    typeof body.request_id === 'string' && body.request_id.trim()
      ? body.request_id.trim()
      : undefined;

  const auth = await authorizeCheckoutConfirmPayment(slug, req, 'checkout.sync_bill');
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isRestaurantFeatureEnabled(auth.featureFlags, 'bill_sync_to_fiscal')) {
    return NextResponse.json({ error: 'bill_sync_disabled' }, { status: 403 });
  }

  const { data: split, error: splitErr } = await auth.admin
    .from('bill_splits')
    .select('id, restaurant_id, table_id, session_id, status, total_amount')
    .eq('id', billSplitId)
    .eq('restaurant_id', auth.restaurantId)
    .maybeSingle();

  if (splitErr || !split) {
    return NextResponse.json({ error: 'bill_split_not_found' }, { status: 404 });
  }

  const sessionId = typeof split.session_id === 'string' ? split.session_id : '';
  if (!sessionId) {
    return NextResponse.json({ error: 'missing_session' }, { status: 409 });
  }

  const { data: tableRow } = await auth.admin
    .from('restaurant_tables')
    .select('display_name')
    .eq('id', split.table_id)
    .maybeSingle();

  let orders;
  try {
    orders = await loadTableOrdersForSession(auth.admin, auth.restaurantId, sessionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'orders_lookup_failed';
    return NextResponse.json({ error: 'orders_lookup_failed', message }, { status: 500 });
  }

  const menuIds = distinctMenuItemIdsFromOrders(orders);
  const itemCodeByMenuId: Record<string, string> = {};
  const vatRateByMenuId: Record<string, number> = {};
  if (menuIds.length > 0) {
    const { data: menuRows } = await auth.admin
      .from('menu_items')
      .select('id, item_code, vat_rate')
      .eq('restaurant_id', auth.restaurantId)
      .in('id', menuIds);
    for (const row of menuRows ?? []) {
      const id = String(row.id);
      if (typeof row.item_code === 'string' && row.item_code.trim()) {
        itemCodeByMenuId[id] = row.item_code.trim();
      }
      if (typeof row.vat_rate === 'number' && Number.isFinite(row.vat_rate)) {
        vatRateByMenuId[id] = row.vat_rate;
      }
    }
  }

  const result = await enqueueBillSyncJob({
    admin: auth.admin,
    restaurantId: auth.restaurantId,
    billSplitId,
    tableDisplayName:
      typeof tableRow?.display_name === 'string' ? tableRow.display_name : '—',
    orders,
    itemCodeByMenuId,
    vatRateByMenuId,
    defaultVatRatePercent: DEFAULT_MENU_VAT_RATE,
    createdBy: auth.actor.userId,
    requestId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message, job: result.job ?? null },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    job: result.job,
    reused: result.reused ?? null,
  });
}

/** Latest job for a bill_split (checkout status). */
export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }
  const sourceSaleId = new URL(req.url).searchParams.get('source_sale_id')?.trim() ?? '';
  if (!sourceSaleId) {
    return NextResponse.json({ error: 'missing_source_sale_id' }, { status: 400 });
  }

  const auth = await authorizeCheckoutConfirmPayment(slug, req, 'checkout.sync_bill');
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isRestaurantFeatureEnabled(auth.featureFlags, 'bill_sync_to_fiscal')) {
    return NextResponse.json({ error: 'bill_sync_disabled' }, { status: 403 });
  }

  const { data, error } = await auth.admin
    .from('bill_sync_jobs')
    .select('id, status, request_id, error_code, error_message, payload, created_at, updated_at')
    .eq('restaurant_id', auth.restaurantId)
    .eq('source_sale_id', sourceSaleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ job: null });
  }

  const payload = data.payload as BillSyncPayload | null;
  const content_fingerprint =
    payload && typeof payload === 'object' ? billSyncContentFingerprint(payload) : null;

  return NextResponse.json({
    job: {
      id: data.id,
      status: data.status,
      request_id: data.request_id,
      error_code: data.error_code,
      error_message: data.error_message,
      created_at: data.created_at,
      updated_at: data.updated_at,
      content_fingerprint,
    },
  });
}
