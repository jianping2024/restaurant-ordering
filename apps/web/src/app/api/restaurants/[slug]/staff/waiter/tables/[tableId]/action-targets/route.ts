import { NextResponse } from 'next/server';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { fetchWaiterTableActionTargets } from '@/lib/staff-board';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: { slug: string; tableId: string } },
) {
  const slug = params.slug;
  const tableId = parseTableIdParam(params.tableId);
  if (!slug || !tableId) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const url = new URL(req.url);
  const operation = url.searchParams.get('operation');
  if (operation !== 'transfer' && operation !== 'merge') {
    return NextResponse.json({ error: 'invalid_operation' }, { status: 400 });
  }

  const ctx = await staffAuthFromRequest(req, slug, 'waiter');
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const tables = await fetchWaiterTableActionTargets(
    admin,
    ctx.restaurant_id,
    tableId,
    operation,
  );
  return NextResponse.json({ tables });
}
