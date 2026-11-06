import { NextResponse } from 'next/server';
import {
  loadWritableOperationalContext,
  menuApiError,
  readJsonBody,
} from '@/lib/dashboard-menu-api';
import {
  createMenuChoiceOption,
  deleteMenuChoiceOption,
  parseChoiceNameBody,
  updateMenuChoiceOption,
} from '@/lib/menu-choice-options-server';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const ctx = await loadWritableOperationalContext('dashboard.menu.view');
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const groupId = parseTableIdParam(body.group_id);
  if (!groupId) {
    return NextResponse.json({ error: 'invalid_choice_group_id' }, { status: 400 });
  }

  const fields = parseChoiceNameBody(body);
  if ('error' in fields) return menuApiError(fields);

  const result = await createMenuChoiceOption(ctx.admin, ctx.restaurantId, groupId, fields);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(req: Request) {
  const ctx = await loadWritableOperationalContext('dashboard.menu.view');
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const optionId = parseTableIdParam(body.option_id);
  if (!optionId) {
    return NextResponse.json({ error: 'invalid_choice_option_id' }, { status: 400 });
  }

  if (typeof body.active === 'boolean') {
    const result = await updateMenuChoiceOption(ctx.admin, ctx.restaurantId, optionId, {
      active: body.active,
    });
    if ('error' in result) return menuApiError(result);
    return NextResponse.json(result);
  }

  const fields = parseChoiceNameBody(body);
  if ('error' in fields) return menuApiError(fields);
  const result = await updateMenuChoiceOption(ctx.admin, ctx.restaurantId, optionId, fields);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json(result);
}

export async function DELETE(req: Request) {
  const ctx = await loadWritableOperationalContext('dashboard.menu.view');
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const optionId = parseTableIdParam(body.option_id);
  if (!optionId) {
    return NextResponse.json({ error: 'invalid_choice_option_id' }, { status: 400 });
  }

  const result = await deleteMenuChoiceOption(ctx.admin, ctx.restaurantId, optionId);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json(result);
}
