import { NextResponse } from 'next/server';
import {
  loadWritableMenuContext,
  menuApiError,
  readJsonBody,
} from '@/lib/dashboard-menu-api';
import {
  createPrintStation,
  deletePrintStation,
  parsePrintStationBody,
  swapPrintStationOrder,
  updatePrintStation,
} from '@/lib/dashboard-menu-server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const ctx = await loadWritableMenuContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const fields = parsePrintStationBody(body);
  if ('error' in fields) return menuApiError(fields);

  const result = await createPrintStation(ctx.admin, ctx.restaurantId, fields);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json({ station: result.station }, { status: 201 });
}

export async function PATCH(req: Request) {
  const ctx = await loadWritableMenuContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  if (body.action === 'swap_order') {
    if (typeof body.station_id_a !== 'string' || typeof body.station_id_b !== 'string') {
      return NextResponse.json({ error: 'invalid_station_id' }, { status: 400 });
    }
    const result = await swapPrintStationOrder(
      ctx.admin,
      ctx.restaurantId,
      body.station_id_a,
      body.station_id_b,
    );
    if ('error' in result) return menuApiError(result);
    return NextResponse.json({ ok: true });
  }

  if (typeof body.station_id !== 'string') {
    return NextResponse.json({ error: 'invalid_station_id' }, { status: 400 });
  }

  const fields = parsePrintStationBody(body);
  if ('error' in fields) return menuApiError(fields);

  const result = await updatePrintStation(ctx.admin, ctx.restaurantId, body.station_id, fields);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json({ station: result.station });
}

export async function DELETE(req: Request) {
  const ctx = await loadWritableMenuContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;
  if (typeof body.station_id !== 'string') {
    return NextResponse.json({ error: 'invalid_station_id' }, { status: 400 });
  }

  const result = await deletePrintStation(ctx.admin, ctx.restaurantId, body.station_id);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json({ ok: true });
}
