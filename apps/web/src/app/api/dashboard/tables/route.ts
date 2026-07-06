import { NextResponse } from 'next/server';
import { loadFrontdeskDashboardTables } from '@/lib/dashboard-tables';
import {
  deleteRestaurantTables,
  parseDeleteTableIds,
  resolveDeleteTableTargets,
} from '@/lib/restaurant-table-delete';
import {
  isValidTableAddCount,
  nextDefaultTableDisplayNames,
  parseRestaurantTablePatchRows,
  projectRestaurantTablePatches,
  restaurantTableSettingsEqual,
  validateRestaurantTableSettings,
  type RestaurantTableRow,
} from '@/lib/restaurant-tables';
import { verifyStaffPassword } from '@/lib/verify-staff-password';

export const runtime = 'nodejs';

function jsonTables(tables: RestaurantTableRow[]) {
  return NextResponse.json({ tables });
}

export async function POST(req: Request) {
  const loaded = await loadFrontdeskDashboardTables();
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

  const next = await loadFrontdeskDashboardTables();
  if ('error' in next) {
    return NextResponse.json({ error: next.error, message: next.message }, { status: next.status });
  }
  return jsonTables(next.tables);
}

export async function PATCH(req: Request) {
  const loaded = await loadFrontdeskDashboardTables();
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
  const parsed = parseRestaurantTablePatchRows(body.tables, currentById);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const projected = projectRestaurantTablePatches(loaded.tables, parsed.updates);
  const validationError = validateRestaurantTableSettings(projected);
  if (validationError === 'duplicate_name') {
    return NextResponse.json({ error: 'duplicate_table_name' }, { status: 400 });
  }
  if (validationError) {
    return NextResponse.json({ error: 'invalid_tables' }, { status: 400 });
  }

  for (const row of parsed.updates) {
    const existing = currentById.get(row.id);
    if (existing && restaurantTableSettingsEqual(existing, row)) {
      continue;
    }
    const { error } = await loaded.admin
      .from('restaurant_tables')
      .update({
        display_name: row.display_name,
        seat_min: row.seat_min,
        seat_max: row.seat_max,
      })
      .eq('id', row.id)
      .eq('restaurant_id', loaded.restaurant.id)
      .is('deleted_at', null);
    if (error) {
      return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
    }
  }

  const next = await loadFrontdeskDashboardTables();
  if ('error' in next) {
    return NextResponse.json({ error: next.error, message: next.message }, { status: next.status });
  }
  return jsonTables(next.tables);
}

export async function DELETE(req: Request) {
  const loaded = await loadFrontdeskDashboardTables();
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error, message: loaded.message }, { status: loaded.status });
  }

  let body: { table_ids?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableIds = parseDeleteTableIds(body.table_ids);
  if (!tableIds) {
    return NextResponse.json({ error: 'invalid_table_ids' }, { status: 400 });
  }

  if (typeof body.password !== 'string' || !body.password.trim()) {
    return NextResponse.json({ error: 'password_required' }, { status: 400 });
  }

  const passwordCheck = await verifyStaffPassword(body.password);
  if (!passwordCheck.ok) {
    if (passwordCheck.error === 'misconfigured') {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 });
  }

  const resolved = resolveDeleteTableTargets(tableIds, loaded.tables);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 404 });
  }

  const deleted = await deleteRestaurantTables(loaded.admin, loaded.restaurant.id, resolved.targets);
  if (!deleted.ok) {
    if (deleted.error === 'tables_have_active_sessions') {
      return NextResponse.json(
        {
          error: deleted.error,
          display_names: deleted.displayNames ?? [],
        },
        { status: 409 },
      );
    }
    if (deleted.error === 'delete_failed') {
      return NextResponse.json({ error: deleted.error }, { status: 500 });
    }
    return NextResponse.json({ error: deleted.error }, { status: 400 });
  }

  const next = await loadFrontdeskDashboardTables();
  if ('error' in next) {
    return NextResponse.json({ error: next.error, message: next.message }, { status: next.status });
  }
  return jsonTables(next.tables);
}
