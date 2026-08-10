import { NextResponse } from 'next/server';
import { applyKitchenPrep, parseKitchenLineSelections } from '@/lib/kitchen-prep-serve';
import { staffAuditActor } from '@/lib/audit';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await staffAuthFromRequest(req, slug, 'orders.kitchen_update');
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const printStationId = (body as { print_station_id?: unknown }).print_station_id;
  if (typeof printStationId !== 'string' || !printStationId.trim()) {
    return NextResponse.json({ error: 'invalid_print_station_id' }, { status: 400 });
  }

  const selections = parseKitchenLineSelections(body);
  if (!selections) {
    return NextResponse.json({ error: 'invalid_selections' }, { status: 400 });
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

  const result = await applyKitchenPrep({
    admin,
    restaurant: {
      id: restaurant.id as string,
      print_locale: (restaurant.print_locale as string | null) ?? null,
      print_agent_config: restaurant.print_agent_config,
    },
    printStationId,
    selections,
    actor: staffAuditActor(ctx.user_id, ctx.role_name || ctx.role, ctx.role),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.message ? { message: result.message } : {}) },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    printed_tables: result.printed_tables,
    ...(result.errors ? { errors: result.errors } : {}),
  });
}
