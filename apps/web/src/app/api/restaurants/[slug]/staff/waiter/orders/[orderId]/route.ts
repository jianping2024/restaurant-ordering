import { NextResponse } from 'next/server';
import { loadStaffAuditActor } from '@/lib/audit';
import { openTableAuthFromRequest } from '@/lib/staff-api-auth';
import { patchOrderItemsWithVoidAudit } from '@/lib/order-item-void/patch-order-items.service';
import { createAdminClient } from '@/lib/supabase/admin';
import { sessionIdBlocksWaiterMutation, sessionBillingResponse } from '@/lib/waiter-session-guard';
import type { Order, OrderItem } from '@/types';

export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  { params }: { params: { slug: string; orderId: string } },
) {
  const slug = params.slug;
  const orderId = params.orderId;
  if (!slug || !orderId) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const ctx = await openTableAuthFromRequest(req, slug);
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: {
    items?: unknown;
    updated_at?: unknown;
    void_reason?: unknown;
    void_reason_detail?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!Array.isArray(body.items) || typeof body.updated_at !== 'string') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const items = body.items as OrderItem[];
  const voidReason = typeof body.void_reason === 'string' ? body.void_reason : null;
  const voidReasonDetail =
    typeof body.void_reason_detail === 'string' ? body.void_reason_detail : null;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: existing, error: findErr } = await admin
    .from('orders')
    .select('id, restaurant_id, updated_at, session_id, table_id, display_name, items, status')
    .eq('id', orderId)
    .maybeSingle();

  if (findErr || !existing || existing.restaurant_id !== ctx.restaurant_id) {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
  }

  if (existing.updated_at !== body.updated_at) {
    return NextResponse.json({ error: 'conflict' }, { status: 409 });
  }

  const sessionId = existing.session_id as string | null | undefined;
  if (sessionId && (await sessionIdBlocksWaiterMutation(admin, sessionId))) {
    return sessionBillingResponse();
  }

  const actor = await loadStaffAuditActor(admin, {
    restaurantId: ctx.restaurant_id,
    userId: ctx.user_id,
    role: ctx.role,
  });

  const result = await patchOrderItemsWithVoidAudit({
    admin,
    restaurantId: ctx.restaurant_id,
    actor,
    orderId,
    existing: {
      items: (existing.items || []) as OrderItem[],
      updated_at: existing.updated_at as string,
      session_id: existing.session_id as string | null,
      table_id: existing.table_id as string | null,
      display_name: existing.display_name as string | null,
      status: existing.status as Order['status'],
    },
    nextItems: items,
    voidReason,
    voidReasonDetail,
  });

  if (!result.ok) {
    if (
      result.code === 'reason_required' ||
      result.code === 'invalid_reason' ||
      result.code === 'reason_detail_required'
    ) {
      return NextResponse.json({ error: result.code }, { status: 400 });
    }
    if (result.code === 'conflict') {
      return NextResponse.json({ error: 'conflict' }, { status: 409 });
    }
    return NextResponse.json({ error: result.code }, { status: 500 });
  }

  return NextResponse.json({ ok: true, order: result.order });
}
