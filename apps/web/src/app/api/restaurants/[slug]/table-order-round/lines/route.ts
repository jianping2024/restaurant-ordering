import { NextResponse } from 'next/server';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import {
  deleteOwnRoundLine,
  getRoundSnapshot,
  loadMenuItemForRoundLine,
  upsertRoundLine,
} from '@/lib/table-order-round/service';
import {
  loadTableOrderRoundContext,
  roundSnapshotJson,
} from '@/lib/table-order-round/request-context';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  let body: {
    table_id?: unknown;
    guest_client_id?: unknown;
    menu_item_id?: unknown;
    qty?: unknown;
    note?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const loaded = await loadTableOrderRoundContext({
    slug: params.slug,
    tableIdRaw: body.table_id,
    guestClientIdRaw: body.guest_client_id,
    requireGuestClient: true,
  });
  if (!loaded.ok) return loaded.response;
  const { ctx } = loaded;
  const guestClientId = ctx.guestClientId!;

  const menuItemId = parseTableIdParam(body.menu_item_id);
  if (!menuItemId) {
    return NextResponse.json({ error: 'invalid_menu_item' }, { status: 400 });
  }

  const qtyRaw = typeof body.qty === 'number' ? body.qty : Number(body.qty);
  const qty = Math.floor(qtyRaw);
  if (!Number.isFinite(qty) || qty < 1) {
    return NextResponse.json({ error: 'invalid_qty' }, { status: 400 });
  }

  const menu = await loadMenuItemForRoundLine(ctx.admin, ctx.restaurant.restaurantId, menuItemId);
  if (!menu.ok) {
    return NextResponse.json(
      { error: menu.error === 'menu_item_not_found' ? 'invalid_menu_item' : menu.error },
      { status: menu.error === 'menu_item_not_found' ? 400 : 500 },
    );
  }
  if (!menu.available) {
    return NextResponse.json({ error: 'menu_item_unavailable' }, { status: 400 });
  }
  if (menu.price !== 0) {
    return NextResponse.json({ error: 'menu_item_not_free' }, { status: 400 });
  }

  const result = await upsertRoundLine({
    admin: ctx.admin,
    restaurantId: ctx.restaurant.restaurantId,
    sessionId: ctx.writeContext.session.id as string,
    tableId: ctx.tableId,
    guestClientId,
    menuItemId,
    qty,
    note: typeof body.note === 'string' ? body.note : '',
    priceIsFree: true,
    settings: ctx.settings,
    liveGuestCount: ctx.liveGuestCount,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const snapshot = await getRoundSnapshot({
    admin: ctx.admin,
    restaurantId: ctx.restaurant.restaurantId,
    sessionId: ctx.writeContext.session.id as string,
    sessionOrders: ctx.writeContext.sessionOrders,
    settings: ctx.settings,
  });

  return NextResponse.json({
    ...roundSnapshotJson(snapshot),
    line: result.data.line,
  });
}

export async function DELETE(req: Request, { params }: { params: { slug: string } }) {
  const url = new URL(req.url);
  const lineId = parseTableIdParam(url.searchParams.get('line_id') ?? url.searchParams.get('id'));
  if (!lineId) {
    return NextResponse.json({ error: 'invalid_line_id' }, { status: 400 });
  }

  const loaded = await loadTableOrderRoundContext({
    slug: params.slug,
    tableIdRaw: url.searchParams.get('table_id'),
    guestClientIdRaw: url.searchParams.get('guest_client_id'),
    requireGuestClient: true,
  });
  if (!loaded.ok) return loaded.response;
  const { ctx } = loaded;

  const result = await deleteOwnRoundLine({
    admin: ctx.admin,
    restaurantId: ctx.restaurant.restaurantId,
    sessionId: ctx.writeContext.session.id as string,
    guestClientId: ctx.guestClientId!,
    lineId,
    settings: ctx.settings,
    liveGuestCount: ctx.liveGuestCount,
    sessionOrders: ctx.writeContext.sessionOrders,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(roundSnapshotJson(result.data.snapshot));
}
