import { NextResponse } from 'next/server';
import {
  loadWritableOperationalContext,
  menuApiError,
  readJsonBody,
} from '@/lib/dashboard-menu-api';
import {
  createMenuChoiceGroup,
  deleteMenuChoiceGroup,
  listMenuChoiceDictionary,
  parseChoiceNameBody,
  updateMenuChoiceGroup,
} from '@/lib/menu-choice-options-server';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { requireStoreRestaurantId } from '@/lib/restaurant-api-store';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const ctx = await loadWritableOperationalContext('dashboard.menu.view', storeId);
  if (ctx instanceof NextResponse) return ctx;

  const result = await listMenuChoiceDictionary(ctx.admin, ctx.restaurantId);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const ctx = await loadWritableOperationalContext('dashboard.menu.view', storeId);
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const fields = parseChoiceNameBody(body);
  if ('error' in fields) return menuApiError(fields);

  const result = await createMenuChoiceGroup(ctx.admin, ctx.restaurantId, fields);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const ctx = await loadWritableOperationalContext('dashboard.menu.view', storeId);
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const groupId = parseTableIdParam(body.group_id);
  if (!groupId) {
    return NextResponse.json({ error: 'invalid_choice_group_id' }, { status: 400 });
  }

  if (typeof body.active === 'boolean') {
    const result = await updateMenuChoiceGroup(ctx.admin, ctx.restaurantId, groupId, {
      active: body.active,
    });
    if ('error' in result) return menuApiError(result);
    return NextResponse.json(result);
  }

  const fields = parseChoiceNameBody(body);
  if ('error' in fields) return menuApiError(fields);
  const result = await updateMenuChoiceGroup(ctx.admin, ctx.restaurantId, groupId, fields);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json(result);
}

export async function DELETE(req: Request, { params }: { params: { slug: string } }) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const ctx = await loadWritableOperationalContext('dashboard.menu.view', storeId);
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const groupId = parseTableIdParam(body.group_id);
  if (!groupId) {
    return NextResponse.json({ error: 'invalid_choice_group_id' }, { status: 400 });
  }

  const result = await deleteMenuChoiceGroup(ctx.admin, ctx.restaurantId, groupId);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json(result);
}
