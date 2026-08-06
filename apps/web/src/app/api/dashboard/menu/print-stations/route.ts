import { NextResponse } from 'next/server';
import {
  loadWritableOperationalContext,
  menuApiError,
  readJsonBody,
} from '@/lib/dashboard-menu-api';
import {
  createPrintStation,
  deletePrintStation,
  parsePrintStationBody,
  reorderPrintStations,
  updatePrintStation,
} from '@/lib/dashboard-menu-server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const ctx = await loadWritableOperationalContext('dashboard.menu.view');
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
  const ctx = await loadWritableOperationalContext('dashboard.menu.view');
  if (ctx instanceof NextResponse) return ctx;

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  if (body.action === 'reorder') {
    const result = await reorderPrintStations(ctx.admin, ctx.restaurantId, body.ordered_ids);
    if ('error' in result) return menuApiError(result);
    return NextResponse.json({ ok: true });
  }

  if (typeof body.action === 'string') {
    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
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
  const ctx = await loadWritableOperationalContext('dashboard.menu.view');
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
