import { NextResponse } from 'next/server';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseTableNumberParamOrNull } from '@/lib/restaurant-table-numbers';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await staffAuthFromRequest(req, slug, 'waiter');
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { table_number?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableNum = parseTableNumberParamOrNull(body.table_number);
  if (!tableNum) {
    return NextResponse.json({ error: 'invalid_table_number' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: session, error: findError } = await admin
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', ctx.restaurant_id)
    .eq('table_number', tableNum)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError || !session?.id) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  const { error: updError } = await admin
    .from('table_sessions')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_reason: 'waiter_closed',
    })
    .eq('id', session.id);

  if (updError) {
    return NextResponse.json({ error: 'update_failed', message: updError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
