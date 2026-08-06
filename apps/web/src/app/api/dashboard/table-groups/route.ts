import { NextResponse } from 'next/server';
import {
  dashboardApiError,
  loadWritableOperationalContext,
  readJsonBody,
} from '@/lib/dashboard-api-shared';
import {
  createTableGroup,
  deleteTableGroup,
  reorderTableGroupMembers,
  reorderTableGroups,
  updateTableGroup,
} from '@/lib/dashboard-table-groups-server';

export const runtime = 'nodejs';

function jsonGroups(payload: { groups: unknown[]; members: unknown[]; tables?: unknown[] }) {
  return NextResponse.json(payload);
}

export async function POST(req: Request) {
  const ctx = await loadWritableOperationalContext('dashboard.tables.view');
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  if (typeof body.name !== 'string') {
    return NextResponse.json({ error: 'invalid_group_body' }, { status: 400 });
  }

  const result = await createTableGroup(ctx.admin, ctx.restaurantId, {
    name: body.name,
    remarks: typeof body.remarks === 'string' ? body.remarks : null,
    table_ids: Array.isArray(body.table_ids)
      ? body.table_ids.filter((id): id is string => typeof id === 'string')
      : [],
  });

  if ('error' in result) return dashboardApiError(result);
  return jsonGroups(result.payload);
}

export async function PATCH(req: Request) {
  const ctx = await loadWritableOperationalContext('dashboard.tables.view');
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  if (body.action === 'reorder') {
    const result = await reorderTableGroups(ctx.admin, ctx.restaurantId, body.ordered_ids);
    if ('error' in result) return dashboardApiError(result);
    return jsonGroups(result.payload);
  }

  if (body.action === 'reorder_members') {
    const result = await reorderTableGroupMembers(
      ctx.admin,
      ctx.restaurantId,
      body.group_id,
      body.ordered_ids,
    );
    if ('error' in result) return dashboardApiError(result);
    return jsonGroups(result.payload);
  }

  if (typeof body.action === 'string') {
    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  }

  if (typeof body.group_id !== 'string' || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'invalid_group_body' }, { status: 400 });
  }

  const result = await updateTableGroup(ctx.admin, ctx.restaurantId, body.group_id, {
    name: body.name,
    remarks: typeof body.remarks === 'string' ? body.remarks : null,
    table_ids: Array.isArray(body.table_ids)
      ? body.table_ids.filter((id): id is string => typeof id === 'string')
      : [],
  });
  if ('error' in result) return dashboardApiError(result);
  return jsonGroups(result.payload);
}

export async function DELETE(req: Request) {
  const ctx = await loadWritableOperationalContext('dashboard.tables.view');
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  if (typeof body.group_id !== 'string') {
    return NextResponse.json({ error: 'invalid_group_id' }, { status: 400 });
  }

  const result = await deleteTableGroup(ctx.admin, ctx.restaurantId, body.group_id);
  if ('error' in result) return dashboardApiError(result);
  return jsonGroups(result.payload);
}
