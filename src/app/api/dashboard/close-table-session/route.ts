import { NextResponse } from 'next/server';
import { loadOwnerDashboardTables } from '@/lib/dashboard-tables';
import { closeActiveTableSessionWithOperationalCleanup } from '@/lib/close-active-table-session-with-cleanup';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const loaded = await loadOwnerDashboardTables();
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error, message: loaded.message }, { status: loaded.status });
  }

  let body: { table_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableId = parseTableIdParam(body.table_id);
  if (!tableId) {
    return NextResponse.json({ error: 'invalid_table_id' }, { status: 400 });
  }

  const result = await closeActiveTableSessionWithOperationalCleanup(
    loaded.admin,
    loaded.restaurant.id,
    tableId,
    'owner_closed',
  );

  if (!result.ok) {
    const status = result.code === 'no_session' ? 404 : 500;
    return NextResponse.json({ error: result.code, message: result.message }, { status });
  }

  return NextResponse.json({ ok: true, session_id: result.session_id });
}
