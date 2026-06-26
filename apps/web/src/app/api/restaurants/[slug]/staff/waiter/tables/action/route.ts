import { NextResponse } from 'next/server';
import { openTableAuthFromRequest } from '@/lib/staff-api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseTableIdParam, tableIdsEqual } from '@/lib/restaurant-tables';
import { tableSessionBlocksWaiterMutation, sessionBillingResponse } from '@/lib/waiter-session-guard';

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

  let body: { action?: unknown; from_table_id?: unknown; to_table_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const action = body.action;
  const fromTableId = parseTableIdParam(body.from_table_id);
  const toTableId = parseTableIdParam(body.to_table_id);

  if (action !== 'transfer' && action !== 'merge') {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }
  if (!fromTableId || !toTableId || tableIdsEqual(fromTableId, toTableId)) {
    return NextResponse.json({ error: 'invalid_tables' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  if (await tableSessionBlocksWaiterMutation(admin, ctx.restaurant_id, fromTableId)) {
    return sessionBillingResponse();
  }

  const { data: rpcResult, error } =
    action === 'transfer'
      ? await admin.rpc('transfer_table_session', {
          p_restaurant_id: ctx.restaurant_id,
          p_from_table_id: fromTableId,
          p_to_table_id: toTableId,
        })
      : await admin.rpc('merge_table_sessions', {
          p_restaurant_id: ctx.restaurant_id,
          p_source_table_id: fromTableId,
          p_target_table_id: toTableId,
        });

  if (error) {
    return NextResponse.json(
      { error: 'rpc_failed', message: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, session_id: rpcResult });
}
