import { NextResponse } from 'next/server';
import { openTableAuthFromRequest } from '@/lib/staff-api-auth';
import { normalizeBuffetGuestCounts } from '@/lib/buffet-order';
import { runBuffetWaiterOpenPipeline } from '@/lib/buffet-waiter-pipeline';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await openTableAuthFromRequest(req, slug);
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: {
    table_id?: unknown;
    buffet_id?: unknown;
    adult_count?: unknown;
    child_count?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableId = parseTableIdParam(body.table_id);
  const buffetId = typeof body.buffet_id === 'string' ? body.buffet_id : '';
  const { adults: adultCount, children: childCount } = normalizeBuffetGuestCounts(
    Number(body.adult_count) || 0,
    Number(body.child_count) || 0,
  );

  if (!tableId || !buffetId) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const result = await runBuffetWaiterOpenPipeline(admin, {
    restaurantId: ctx.restaurant_id,
    userId: ctx.user_id,
    tableId,
    buffetId,
    adultCount,
    childCount,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    model: result.model,
    ...(result.unchanged ? { unchanged: true } : {}),
  });
}
