import { NextResponse } from 'next/server';
import { loadOwnerDashboardTables } from '@/lib/dashboard-tables';
import {
  isValidTableAddCount,
  isValidTableDisplayName,
  nextDefaultTableDisplayNames,
  normalizeTableDisplayName,
  parseTableIdParam,
  type RestaurantTableRow,
} from '@/lib/restaurant-tables';

export const runtime = 'nodejs';

function jsonTables(tables: RestaurantTableRow[]) {
  return NextResponse.json({ tables });
}

export async function POST(req: Request) {
  const loaded = await loadOwnerDashboardTables();
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error, message: loaded.message }, { status: loaded.status });
  }

  let body: { count?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const count = typeof body.count === 'number' ? Math.floor(body.count) : NaN;
  if (!isValidTableAddCount(count, loaded.tables.length)) {
    return NextResponse.json({ error: 'invalid_add_count' }, { status: 400 });
  }

  const displayNames = nextDefaultTableDisplayNames(
    loaded.tables.map((row) => row.display_name),
    count,
  );
  const startOrder = Math.max(0, ...loaded.tables.map((row) => row.sort_order)) + 1;
  const rows = displayNames.map((display_name, index) => ({
    restaurant_id: loaded.restaurant.id,
    display_name,
    sort_order: startOrder + index,
  }));

  const { error } = await loaded.admin.from('restaurant_tables').insert(rows);
  if (error) {
    return NextResponse.json({ error: 'insert_failed', message: error.message }, { status: 500 });
  }

  const next = await loadOwnerDashboardTables();
  if ('error' in next) {
    return NextResponse.json({ error: next.error, message: next.message }, { status: next.status });
  }
  return jsonTables(next.tables);
}

export async function PATCH(req: Request) {
  const loaded = await loadOwnerDashboardTables();
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error, message: loaded.message }, { status: loaded.status });
  }

  let body: { tables?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!Array.isArray(body.tables)) {
    return NextResponse.json({ error: 'invalid_tables' }, { status: 400 });
  }

  const currentById = new Map(loaded.tables.map((row) => [row.id, row]));
  const updates: RestaurantTableRow[] = [];

  for (const row of body.tables) {
    if (!row || typeof row !== 'object') {
      return NextResponse.json({ error: 'invalid_tables' }, { status: 400 });
    }
    const raw = row as Record<string, unknown>;
    const id = parseTableIdParam(raw.id);
    const displayName = normalizeTableDisplayName(typeof raw.display_name === 'string' ? raw.display_name : '');
    if (!id || !currentById.has(id) || !isValidTableDisplayName(displayName)) {
      return NextResponse.json({ error: 'invalid_tables' }, { status: 400 });
    }
    updates.push({
      id,
      display_name: displayName,
      sort_order: currentById.get(id)!.sort_order,
    });
  }

  if (updates.length !== loaded.tables.length) {
    return NextResponse.json({ error: 'table_set_mismatch' }, { status: 400 });
  }
  const names = updates.map((row) => row.display_name);
  if (new Set(names).size !== names.length) {
    return NextResponse.json({ error: 'duplicate_table_name' }, { status: 400 });
  }

  for (const row of updates) {
    const existing = currentById.get(row.id);
    if (existing?.display_name === row.display_name) continue;
    const { error } = await loaded.admin
      .from('restaurant_tables')
      .update({ display_name: row.display_name })
      .eq('id', row.id)
      .eq('restaurant_id', loaded.restaurant.id)
      .is('deleted_at', null);
    if (error) {
      return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
    }
  }

  const next = await loadOwnerDashboardTables();
  if ('error' in next) {
    return NextResponse.json({ error: next.error, message: next.message }, { status: next.status });
  }
  return jsonTables(next.tables);
}

export async function DELETE(req: Request) {
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

  const { data: table } = await loaded.admin
    .from('restaurant_tables')
    .select('id')
    .eq('id', tableId)
    .eq('restaurant_id', loaded.restaurant.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!table) {
    return NextResponse.json({ error: 'table_not_found' }, { status: 404 });
  }

  const { data: activeSession } = await loaded.admin
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', loaded.restaurant.id)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .limit(1)
    .maybeSingle();
  if (activeSession?.id) {
    return NextResponse.json({ error: 'table_has_active_session' }, { status: 409 });
  }

  const { error } = await loaded.admin
    .from('restaurant_tables')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', tableId)
    .eq('restaurant_id', loaded.restaurant.id)
    .is('deleted_at', null);
  if (error) {
    return NextResponse.json({ error: 'delete_failed', message: error.message }, { status: 500 });
  }

  const next = await loadOwnerDashboardTables();
  if ('error' in next) {
    return NextResponse.json({ error: next.error, message: next.message }, { status: next.status });
  }
  return jsonTables(next.tables);
}
