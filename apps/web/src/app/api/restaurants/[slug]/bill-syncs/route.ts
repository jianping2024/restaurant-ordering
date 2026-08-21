import { billSyncContentFingerprint } from '@/lib/bill-sync-content-fingerprint';
import { billSyncContentUnchanged } from '@/lib/bill-sync-content-unchanged';
import {
  liveBillSyncContentFingerprint,
  loadBillSyncLiveContext,
} from '@/lib/bill-sync-live-context';
import type { BillSyncPayload } from '@/lib/bill-sync-payload';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import { enqueueBillSyncJob } from '@/lib/bill-sync-enqueue';
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

  const loaded = await loadBillSyncLiveContext({
    admin: auth.admin,
    restaurantId: auth.restaurantId,
    billSplitId,
  });
  if (!loaded.ok) {
    return NextResponse.json(
      { error: loaded.error, message: loaded.message },
      { status: loaded.status },
    );
  }

  const { ctx } = loaded;
  const result = await enqueueBillSyncJob({
    admin: auth.admin,
    restaurantId: auth.restaurantId,
    billSplitId: ctx.billSplitId,
    tableDisplayName: ctx.tableDisplayName,
    splitMode: ctx.splitMode,
    persons: ctx.persons,
    orders: ctx.orders,
    itemCodeByMenuId: ctx.itemCodeByMenuId,
    vatRateByMenuId: ctx.vatRateByMenuId,
    defaultVatRatePercent: ctx.defaultVatRatePercent,
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

/** Latest job + whether live bill still matches last succeeded sync. */
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
    return NextResponse.json({ job: null, content_unchanged: false });
  }

  const payload = data.payload as BillSyncPayload | null;
  const content_fingerprint =
    payload && typeof payload === 'object' ? billSyncContentFingerprint(payload) : null;

  let content_unchanged = false;
  if (data.status === 'succeeded') {
    const loaded = await loadBillSyncLiveContext({
      admin: auth.admin,
      restaurantId: auth.restaurantId,
      billSplitId: sourceSaleId,
    });
    if (loaded.ok) {
      const liveFp = liveBillSyncContentFingerprint(loaded.ctx);
      content_unchanged = billSyncContentUnchanged({
        jobStatus: data.status,
        jobPayload: payload,
        liveFingerprint: liveFp,
      });
    }
  }

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
    content_unchanged,
  });
}
