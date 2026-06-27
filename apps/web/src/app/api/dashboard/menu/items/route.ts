import { NextResponse } from 'next/server';
import {
  loadWritableMenuContext,
  menuApiError,
  readJsonBody,
} from '@/lib/dashboard-menu-api';
import {
  batchSetMenuItemsAvailable,
  createMenuItem,
  deleteMenuItem,
  parseMenuItemBody,
  updateMenuItem,
} from '@/lib/dashboard-menu-server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const ctx = await loadWritableMenuContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const parsed = parseMenuItemBody(body);
  if ('error' in parsed) return menuApiError(parsed);

  const result = await createMenuItem(ctx.admin, ctx.restaurantId, parsed);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json({ item: result.item }, { status: 201 });
}

export async function PATCH(req: Request) {
  const ctx = await loadWritableMenuContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  if (body.action === 'batch_available') {
    if (!Array.isArray(body.item_ids) || body.item_ids.some((id) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'invalid_item_ids' }, { status: 400 });
    }
    if (typeof body.available !== 'boolean') {
      return NextResponse.json({ error: 'invalid_available' }, { status: 400 });
    }
    const result = await batchSetMenuItemsAvailable(
      ctx.admin,
      ctx.restaurantId,
      body.item_ids,
      body.available,
    );
    if ('error' in result) return menuApiError(result);
    return NextResponse.json({ ok: true });
  }

  if (typeof body.item_id !== 'string') {
    return NextResponse.json({ error: 'invalid_item_id' }, { status: 400 });
  }

  const parsed = parseMenuItemBody(body);
  if ('error' in parsed) return menuApiError(parsed);

  const result = await updateMenuItem(ctx.admin, ctx.restaurantId, body.item_id, parsed);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json({ item: result.item });
}

export async function DELETE(req: Request) {
  const ctx = await loadWritableMenuContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  if (typeof body.item_id !== 'string') {
    return NextResponse.json({ error: 'invalid_item_id' }, { status: 400 });
  }

  const result = await deleteMenuItem(ctx.admin, ctx.restaurantId, body.item_id);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json({ ok: true });
}
