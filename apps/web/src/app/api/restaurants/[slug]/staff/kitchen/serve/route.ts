import { NextResponse } from 'next/server';
import { isRestaurantFeatureEnabled } from '@mesa/shared';
import { staffAuditActor } from '@/lib/audit';
import { applyKitchenServe, parseKitchenLineSelections } from '@/lib/kitchen-prep-serve';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await staffAuthFromRequest(req, slug, 'orders.serve_to_table');
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
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
    .select('id, feature_flags, print_agent_config')
    .eq('id', ctx.restaurant_id)
    .maybeSingle();

  if (rErr || !restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
  }

  if (!isRestaurantFeatureEnabled(restaurant.feature_flags, 'kitchen_serve_to_table')) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 403 });
  }

  const result = await applyKitchenServe({
    admin,
    restaurantId: ctx.restaurant_id,
    printAgentConfig: restaurant.print_agent_config,
    selections,
    actor: staffAuditActor(ctx.user_id, ctx.role_name || ctx.role, ctx.role),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.message ? { message: result.message } : {}) },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, served: result.served });
}
