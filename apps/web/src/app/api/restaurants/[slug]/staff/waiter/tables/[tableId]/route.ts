import { NextResponse } from 'next/server';
import { openTableAuthFromRequest } from '@/lib/staff-api-auth';
import { fetchWaiterTablePageModel } from '@/lib/staff-board';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { parseWaiterTableDetailFetchScope } from '@/lib/waiter-table-detail-scope';

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

  const ctx = await openTableAuthFromRequest(req, slug);
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const scope = parseWaiterTableDetailFetchScope(new URL(req.url).searchParams.get('scope'));
  const model = await fetchWaiterTablePageModel(admin, ctx.restaurant_id, tableId, {
    includeOpenTableDefaults: scope === 'full',
  });
  if (!model?.detail.table) {
    return NextResponse.json({ error: 'table_not_found' }, { status: 404 });
  }

  return NextResponse.json(model);
}
