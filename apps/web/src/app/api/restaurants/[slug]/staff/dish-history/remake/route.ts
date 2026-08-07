import { NextResponse } from 'next/server';
import { remakeDishFromHistory } from '@/lib/dish-history-server';
import { can } from '@/lib/permissions/can';
import { staffSessionForSlug } from '@/lib/staff-api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await staffSessionForSlug(slug);
  if (
    !ctx ||
    !can(ctx.capabilities, 'dashboard.dish_history.view') ||
    !can(ctx.capabilities, 'orders.append')
  ) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: {
    order_id?: unknown;
    item_index?: unknown;
    qty?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.order_id !== 'string' || typeof body.item_index !== 'number') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const qty =
    body.qty === undefined || body.qty === null
      ? null
      : typeof body.qty === 'number'
        ? body.qty
        : NaN;
  if (body.qty != null && !Number.isFinite(qty)) {
    return NextResponse.json({ error: 'invalid_qty' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: restaurant, error: rErr } = await admin
    .from('restaurants')
    .select('id, print_locale, print_agent_config')
    .eq('id', ctx.restaurant_id)
    .maybeSingle();

  if (rErr || !restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
  }

  const result = await remakeDishFromHistory({
    admin,
    restaurant: {
      id: restaurant.id as string,
      print_locale: (restaurant.print_locale as string | null) ?? null,
      print_agent_config: restaurant.print_agent_config,
    },
    orderId: body.order_id,
    itemIndex: body.item_index,
    qty,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.message ? { message: result.message } : {}) },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    order_id: result.order_id,
    item_index: result.item_index,
    batch_id: result.batch_id,
    printed: result.printed,
  });
}
