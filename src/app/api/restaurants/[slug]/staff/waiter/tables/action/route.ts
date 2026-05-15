import { NextResponse } from 'next/server';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

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

  let body: { action?: unknown; from_table?: unknown; to_table?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const action = body.action;
  const fromTable = Number(body.from_table);
  const toTable = Number(body.to_table);

  if (action !== 'transfer' && action !== 'merge') {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }
  if (
    !Number.isInteger(fromTable) ||
    !Number.isInteger(toTable) ||
    fromTable < 1 ||
    fromTable > 30 ||
    toTable < 1 ||
    toTable > 30 ||
    fromTable === toTable
  ) {
    return NextResponse.json({ error: 'invalid_tables' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: rpcResult, error } =
    action === 'transfer'
      ? await admin.rpc('transfer_table_session', {
          p_restaurant_id: ctx.restaurant_id,
          p_from_table: fromTable,
          p_to_table: toTable,
        })
      : await admin.rpc('merge_table_sessions', {
          p_restaurant_id: ctx.restaurant_id,
          p_source_table: fromTable,
          p_target_table: toTable,
        });

  if (error) {
    return NextResponse.json(
      { error: 'rpc_failed', message: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, session_id: rpcResult });
}
