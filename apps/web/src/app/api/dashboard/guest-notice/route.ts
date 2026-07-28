import { NextResponse } from 'next/server';
import { loadMenuManagementContext } from '@/lib/dashboard-access';
import { dashboardApiError, readJsonBody } from '@/lib/dashboard-api-shared';
import {
  loadGuestOrderingNotice,
  saveGuestOrderingNotice,
} from '@/lib/guest-ordering-notice-server';

export const runtime = 'nodejs';

export async function GET() {
  const ctx = await loadMenuManagementContext();
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const notice = await loadGuestOrderingNotice(ctx.admin, ctx.restaurantId);
  return NextResponse.json({ notice });
}

export async function PATCH(req: Request) {
  const ctx = await loadMenuManagementContext({ requireWritable: true });
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const result = await saveGuestOrderingNotice(ctx.admin, ctx.restaurantId, body);
  if ('error' in result) {
    return dashboardApiError({ error: result.error, status: result.status });
  }

  return NextResponse.json({ notice: result });
}
