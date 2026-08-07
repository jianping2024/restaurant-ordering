import { NextResponse } from 'next/server';
import { isRestaurantSuspended } from '@mesa/shared';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import { dashboardApiError, readJsonBody } from '@/lib/dashboard-api-shared';
import {
  createKitchenScreen,
  deleteKitchenScreen,
  listKitchenScreens,
  updateKitchenScreen,
} from '@/lib/kitchen-screens-server';
import { can } from '@/lib/permissions/can';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import type { PermissionKey } from '@/lib/permissions/registry';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const MANAGE: PermissionKey = 'floor.kitchen_screens.manage';
const VIEW_ANY: readonly PermissionKey[] = [
  'floor.kitchen_screens.manage',
  'floor.kitchen_board.view',
];

async function loadKitchenScreensActor(options: { requireManage: boolean; writable: boolean }) {
  const access = await getDashboardAccess();
  const loaded = await loadPrincipalWithCapabilities();

  if (
    access.mode === 'unauthenticated' ||
    access.mode === 'onboarding' ||
    access.mode === 'access_error'
  ) {
    return { error: 'unauthorized', status: 401 } as const;
  }
  if (!loaded) {
    return { error: 'unauthorized', status: 401 } as const;
  }

  const allowed = options.requireManage
    ? can(loaded.capabilities, MANAGE)
    : VIEW_ANY.some((key) => can(loaded.capabilities, key));

  if (!allowed) {
    return { error: 'forbidden', status: 403 } as const;
  }

  if (
    options.writable &&
    'suspended_at' in access.restaurant &&
    isRestaurantSuspended(access.restaurant.suspended_at)
  ) {
    return { error: 'restaurant_suspended', status: 403 } as const;
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'server_misconfigured', status: 503 } as const;
  }

  return { admin, restaurantId: access.restaurant.id } as const;
}

export async function GET() {
  const ctx = await loadKitchenScreensActor({ requireManage: false, writable: false });
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const result = await listKitchenScreens(ctx.admin, ctx.restaurantId);
  if (!Array.isArray(result)) return dashboardApiError(result);
  return NextResponse.json({ screens: result });
}

export async function POST(req: Request) {
  const ctx = await loadKitchenScreensActor({ requireManage: true, writable: true });
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  const result = await createKitchenScreen(ctx.admin, ctx.restaurantId, {
    name: typeof body.name === 'string' ? body.name : '',
    station_ids: body.station_ids,
  });
  if ('error' in result) return dashboardApiError(result);
  return NextResponse.json({ screen: result.screen }, { status: 201 });
}

export async function PATCH(req: Request) {
  const ctx = await loadKitchenScreensActor({ requireManage: true, writable: true });
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  if (typeof body.screen_id !== 'string') {
    return NextResponse.json({ error: 'invalid_screen_id' }, { status: 400 });
  }

  const result = await updateKitchenScreen(ctx.admin, ctx.restaurantId, body.screen_id, {
    name: typeof body.name === 'string' ? body.name : undefined,
    station_ids: body.station_ids,
  });
  if ('error' in result) return dashboardApiError(result);
  return NextResponse.json({ screen: result.screen });
}

export async function DELETE(req: Request) {
  const ctx = await loadKitchenScreensActor({ requireManage: true, writable: true });
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await readJsonBody(req);
  if (body instanceof NextResponse) return body;

  if (typeof body.screen_id !== 'string') {
    return NextResponse.json({ error: 'invalid_screen_id' }, { status: 400 });
  }

  const result = await deleteKitchenScreen(ctx.admin, ctx.restaurantId, body.screen_id);
  if ('error' in result) return dashboardApiError(result);
  return NextResponse.json({ ok: true });
}
