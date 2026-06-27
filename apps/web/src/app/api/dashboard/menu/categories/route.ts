import { NextResponse } from 'next/server';
import {
  loadWritableMenuContext,
  menuApiError,
  readJsonBody,
} from '@/lib/dashboard-menu-api';
import {
  createMenuCategory,
  deleteMenuCategory,
  parseCategoryBody,
  parseCategoryParentId,
  updateMenuCategory,
} from '@/lib/dashboard-menu-server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const ctx = await loadWritableMenuContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const fields = parseCategoryBody(body);
  if ('error' in fields) return menuApiError(fields);

  const parentId = parseCategoryParentId(body);
  if (parentId !== null && typeof parentId !== 'string') return menuApiError(parentId);

  const result = await createMenuCategory(ctx.admin, ctx.restaurantId, {
    ...fields,
    parent_id: parentId,
  });
  if ('error' in result) return menuApiError(result);
  return NextResponse.json({ category: result.category }, { status: 201 });
}

export async function PATCH(req: Request) {
  const ctx = await loadWritableMenuContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  if (typeof body.category_id !== 'string') {
    return NextResponse.json({ error: 'invalid_category_id' }, { status: 400 });
  }

  const fields = parseCategoryBody(body);
  if ('error' in fields) return menuApiError(fields);

  const result = await updateMenuCategory(ctx.admin, ctx.restaurantId, body.category_id, fields);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json({ category: result.category });
}

export async function DELETE(req: Request) {
  const ctx = await loadWritableMenuContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  if (typeof body.category_id !== 'string') {
    return NextResponse.json({ error: 'invalid_category_id' }, { status: 400 });
  }
  if (body.mode !== 'empty' && body.mode !== 'migrate' && body.mode !== 'delete_all') {
    return NextResponse.json({ error: 'invalid_delete_mode' }, { status: 400 });
  }

  const result = await deleteMenuCategory(ctx.admin, ctx.restaurantId, {
    category_id: body.category_id,
    mode: body.mode,
    migrate_target_id:
      typeof body.migrate_target_id === 'string' ? body.migrate_target_id : null,
  });
  if ('error' in result) return menuApiError(result);
  return NextResponse.json({ ok: true });
}
