import { NextResponse } from 'next/server';
import {
  dashboardApiError,
  loadWritableOwnerContext,
  readJsonBody,
} from '@/lib/dashboard-api-shared';
import {
  createBuffet,
  createBuffetPriceRule,
  createBuffetTimeSlot,
  deleteBuffet,
  deleteBuffetCalendarOverride,
  deleteBuffetPriceRule,
  deleteBuffetTimeSlot,
  loadBuffetDashboard,
  toggleBuffetPriceRuleActive,
  updateBuffet,
  updateBuffetFridayPolicy,
  updateBuffetPriceRule,
  updateBuffetTimeSlot,
  upsertBuffetCalendarOverrides,
} from '@/lib/dashboard-buffet-server';

export const runtime = 'nodejs';

function jsonData(data: unknown) {
  return NextResponse.json(data);
}

export async function GET() {
  const ctx = await loadWritableOwnerContext();
  if (ctx instanceof NextResponse) return ctx;

  const data = await loadBuffetDashboard(ctx.admin, ctx.restaurantId);
  if ('error' in data) return dashboardApiError(data);
  return jsonData(data);
}

export async function POST(req: Request) {
  const ctx = await loadWritableOwnerContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  if (body.resource === 'buffet') {
    if (typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name_required' }, { status: 400 });
    }
    const result = await createBuffet(ctx.admin, ctx.restaurantId, body.name);
    if ('error' in result) return dashboardApiError(result);
    return jsonData(result.data);
  }

  if (body.resource === 'slot') {
    if (typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name_required' }, { status: 400 });
    }
    const sortOrder = typeof body.sort_order === 'number' ? body.sort_order : 0;
    const result = await createBuffetTimeSlot(ctx.admin, ctx.restaurantId, {
      name: body.name,
      sort_order: sortOrder,
    });
    if ('error' in result) return dashboardApiError(result);
    return jsonData(result.data);
  }

  if (body.resource === 'rule') {
    if (!body.rule || typeof body.rule !== 'object') {
      return NextResponse.json({ error: 'invalid_rule_body' }, { status: 400 });
    }
    const result = await createBuffetPriceRule(
      ctx.admin,
      ctx.restaurantId,
      body.rule as Record<string, unknown>,
    );
    if ('error' in result) return dashboardApiError(result);
    return jsonData(result.data);
  }

  if (body.resource === 'calendar') {
    if (!Array.isArray(body.rows)) {
      return NextResponse.json({ error: 'invalid_calendar_body' }, { status: 400 });
    }
    const rows = body.rows.filter(
      (row): row is { on_date: string; kind: 'holiday' | 'special' } =>
        !!row &&
        typeof row === 'object' &&
        typeof (row as { on_date?: unknown }).on_date === 'string' &&
        ((row as { kind?: unknown }).kind === 'holiday' ||
          (row as { kind?: unknown }).kind === 'special'),
    );
    const result = await upsertBuffetCalendarOverrides(ctx.admin, ctx.restaurantId, rows);
    if ('error' in result) return dashboardApiError(result);
    return jsonData(result.data);
  }

  return NextResponse.json({ error: 'invalid_resource' }, { status: 400 });
}

export async function PATCH(req: Request) {
  const ctx = await loadWritableOwnerContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  if (body.resource === 'friday_policy') {
    const value =
      body.buffet_friday_weekend_from === null
        ? null
        : typeof body.buffet_friday_weekend_from === 'string'
          ? body.buffet_friday_weekend_from
          : undefined;
    if (value === undefined) {
      return NextResponse.json({ error: 'invalid_friday_policy' }, { status: 400 });
    }
    const result = await updateBuffetFridayPolicy(ctx.admin, ctx.restaurantId, value);
    if ('error' in result) return dashboardApiError(result);
    return jsonData(result.data);
  }

  if (typeof body.id !== 'string') {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  if (body.resource === 'buffet') {
    const patch =
      body.patch && typeof body.patch === 'object'
        ? (body.patch as Partial<{ name: string; is_active: boolean }>)
        : {};
    const result = await updateBuffet(ctx.admin, ctx.restaurantId, body.id, patch);
    if ('error' in result) return dashboardApiError(result);
    return jsonData(result.data);
  }

  if (body.resource === 'slot') {
    const patch =
      body.patch && typeof body.patch === 'object' ? (body.patch as Record<string, unknown>) : {};
    const result = await updateBuffetTimeSlot(ctx.admin, ctx.restaurantId, body.id, patch);
    if ('error' in result) return dashboardApiError(result);
    return jsonData(result.data);
  }

  if (body.resource === 'rule') {
    if (!body.rule || typeof body.rule !== 'object') {
      return NextResponse.json({ error: 'invalid_rule_body' }, { status: 400 });
    }
    const result = await updateBuffetPriceRule(
      ctx.admin,
      ctx.restaurantId,
      body.id,
      body.rule as Record<string, unknown>,
    );
    if ('error' in result) return dashboardApiError(result);
    return jsonData(result.data);
  }

  if (body.resource === 'rule_toggle') {
    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'invalid_active' }, { status: 400 });
    }
    const result = await toggleBuffetPriceRuleActive(
      ctx.admin,
      ctx.restaurantId,
      body.id,
      body.is_active,
    );
    if ('error' in result) return dashboardApiError(result);
    return jsonData(result.data);
  }

  return NextResponse.json({ error: 'invalid_resource' }, { status: 400 });
}

export async function DELETE(req: Request) {
  const ctx = await loadWritableOwnerContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  if (body.resource === 'buffet' && typeof body.id === 'string') {
    const result = await deleteBuffet(ctx.admin, ctx.restaurantId, body.id);
    if ('error' in result) return dashboardApiError(result);
    return jsonData(result.data);
  }
  if (body.resource === 'slot' && typeof body.id === 'string') {
    const result = await deleteBuffetTimeSlot(ctx.admin, ctx.restaurantId, body.id);
    if ('error' in result) return dashboardApiError(result);
    return jsonData(result.data);
  }
  if (body.resource === 'rule' && typeof body.id === 'string') {
    const result = await deleteBuffetPriceRule(ctx.admin, ctx.restaurantId, body.id);
    if ('error' in result) return dashboardApiError(result);
    return jsonData(result.data);
  }
  if (body.resource === 'calendar' && typeof body.on_date === 'string') {
    const result = await deleteBuffetCalendarOverride(ctx.admin, ctx.restaurantId, body.on_date);
    if ('error' in result) return dashboardApiError(result);
    return jsonData(result.data);
  }

  return NextResponse.json({ error: 'invalid_resource' }, { status: 400 });
}
