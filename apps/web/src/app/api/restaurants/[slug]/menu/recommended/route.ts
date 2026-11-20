import { NextResponse } from 'next/server';
import {
  loadWritableOperationalContext,
  menuApiError,
  readJsonBody,
} from '@/lib/dashboard-menu-api';
import {
  addRecommendedMenuItems,
  removeRecommendedMenuItem,
  reorderRecommendedMenuItems,
} from '@/lib/dashboard-menu-server';
import { requireStoreRestaurantId } from '@/lib/restaurant-api-store';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const ctx = await loadWritableOperationalContext('dashboard.menu.view', storeId);
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const result = await addRecommendedMenuItems(ctx.admin, ctx.restaurantId, body.menu_item_ids);
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

  if (body.action === 'reorder') {
    const result = await reorderRecommendedMenuItems(
      ctx.admin,
      ctx.restaurantId,
      body.ordered_ids,
    );
    if ('error' in result) return menuApiError(result);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}

export async function DELETE(req: Request, { params }: { params: { slug: string } }) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const ctx = await loadWritableOperationalContext('dashboard.menu.view', storeId);
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const result = await removeRecommendedMenuItem(ctx.admin, ctx.restaurantId, body.menu_item_id);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json(result);
}
