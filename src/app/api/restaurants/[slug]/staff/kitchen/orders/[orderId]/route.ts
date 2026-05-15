import { NextResponse } from 'next/server';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { deriveOrderStatusFromItems } from '@/lib/order-status';
import { createAdminClient } from '@/lib/supabase/admin';
import type { OrderItem } from '@/types';

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

  const ctx = await staffAuthFromRequest(req, slug, 'kitchen');
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { items?: unknown; updated_at?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!Array.isArray(body.items) || typeof body.updated_at !== 'string') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const items = body.items as OrderItem[];
  for (const item of items) {
    const st = item.item_status;
    if (st && st !== 'pending' && st !== 'cooking' && st !== 'done' && st !== 'voided') {
      return NextResponse.json({ error: 'invalid_item_status' }, { status: 400 });
    }
  }

  const nextStatus = deriveOrderStatusFromItems(items);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: existing, error: findErr } = await admin
    .from('orders')
    .select('id, restaurant_id, updated_at')
    .eq('id', orderId)
    .maybeSingle();

  if (findErr || !existing || existing.restaurant_id !== ctx.restaurant_id) {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
  }

  if (existing.updated_at !== body.updated_at) {
    return NextResponse.json({ error: 'conflict' }, { status: 409 });
  }

  const { data: updated, error: updErr } = await admin
    .from('orders')
    .update({
      items,
      status: nextStatus,
    })
    .eq('id', orderId)
    .eq('updated_at', body.updated_at)
    .select('id, items, status, updated_at, table_number, session_id, created_at, restaurant_id, total_amount')
    .maybeSingle();

  if (updErr || !updated) {
    return NextResponse.json({ error: 'conflict' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, order: updated });
}
