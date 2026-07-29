import { NextResponse } from 'next/server';
import {
  dashboardApiError,
  loadWritableOperationalContext,
  readJsonBody,
} from '@/lib/dashboard-api-shared';
import {
  createTableGroup,
  deleteTableGroup,
  moveTableGroupMemberOrder,
  moveTableGroupOrder,
  updateTableGroup,
} from '@/lib/dashboard-table-groups-server';

export const runtime = 'nodejs';

function jsonGroups(payload: { groups: unknown[]; members: unknown[]; tables?: unknown[] }) {
  return NextResponse.json(payload);
}

export async function POST(req: Request) {
  const ctx = await loadWritableOperationalContext();
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
  const ctx = await loadWritableOperationalContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  if (body.action === 'move_order') {
    if (typeof body.group_id !== 'string') {
      return NextResponse.json({ error: 'invalid_group_id' }, { status: 400 });
    }
    if (body.direction !== -1 && body.direction !== 1) {
      return NextResponse.json({ error: 'invalid_direction' }, { status: 400 });
    }
    const result = await moveTableGroupOrder(
      ctx.admin,
      ctx.restaurantId,
      body.group_id,
      body.direction,
    );
    if ('error' in result) return dashboardApiError(result);
    return jsonGroups(result.payload);
  }

  if (body.action === 'move_member_order') {
    if (typeof body.group_id !== 'string') {
      return NextResponse.json({ error: 'invalid_group_id' }, { status: 400 });
    }
    if (typeof body.table_id !== 'string') {
      return NextResponse.json({ error: 'invalid_table_id' }, { status: 400 });
    }
    if (body.direction !== -1 && body.direction !== 1) {
      return NextResponse.json({ error: 'invalid_direction' }, { status: 400 });
    }
    const result = await moveTableGroupMemberOrder(
      ctx.admin,
      ctx.restaurantId,
      body.group_id,
      body.table_id,
      body.direction,
    );
    if ('error' in result) return dashboardApiError(result);
    return jsonGroups(result.payload);
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
  const ctx = await loadWritableOperationalContext();
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
