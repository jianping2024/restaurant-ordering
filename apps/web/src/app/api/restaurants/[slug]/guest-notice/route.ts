import { NextResponse } from 'next/server';
import { resolveDashboardCapabilityAccess } from '@/lib/dashboard-capability-access';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import { dashboardApiError, readJsonBody } from '@/lib/dashboard-api-shared';
import {
  loadGuestOrderingNotice,
  saveGuestOrderingNotice,
} from '@/lib/guest-ordering-notice-server';
import { NAV_PERMISSION } from '@/lib/permissions/registry';
import { dashboardAccessPrincipal } from '@/lib/dashboard-access';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRestaurantSuspended } from '@mesa/shared';
import { requireStoreRestaurantId } from '@/lib/restaurant-api-store';

export const runtime = 'nodejs';

async function loadGuestNoticeActor(storeId: string, options?: { requireWritable?: boolean }) {
  const access = await getDashboardAccess(storeId);
  const loaded = dashboardAccessPrincipal(access);
  const gate = resolveDashboardCapabilityAccess(
    access,
    loaded?.capabilities ?? null,
    NAV_PERMISSION.guestNotice,
  );
  if (!gate.ok) {
    return { error: gate.error, status: gate.status } as const;
  }
  if (
    access.mode === 'unauthenticated' ||
    access.mode === 'forbidden' ||
    access.mode === 'access_error'
  ) {
    return { error: 'unauthorized', status: 401 } as const;
  }
  if (
    options?.requireWritable &&
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

  return { admin, restaurantId: gate.restaurantId } as const;
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const ctx = await loadGuestNoticeActor(storeId);
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const notice = await loadGuestOrderingNotice(ctx.admin, ctx.restaurantId);
  return NextResponse.json({ notice });
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const ctx = await loadGuestNoticeActor(storeId, { requireWritable: true });
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
