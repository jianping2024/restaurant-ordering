import { NextResponse } from 'next/server';
import { resolveDashboardCapabilityAccess } from '@/lib/dashboard-capability-access';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import { dashboardApiError, readJsonBody } from '@/lib/dashboard-api-shared';
import {
  loadGuestOrderingNotice,
  saveGuestOrderingNotice,
} from '@/lib/guest-ordering-notice-server';
import { NAV_PERMISSION } from '@/lib/permissions/registry';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRestaurantSuspended } from '@mesa/shared';

export const runtime = 'nodejs';

async function loadGuestNoticeActor(options?: { requireWritable?: boolean }) {
  const access = await getDashboardAccess();
  const loaded = await loadPrincipalWithCapabilities();
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
    access.mode === 'onboarding' ||
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

export async function GET() {
  const ctx = await loadGuestNoticeActor();
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const notice = await loadGuestOrderingNotice(ctx.admin, ctx.restaurantId);
  return NextResponse.json({ notice });
}

export async function PATCH(req: Request) {
  const ctx = await loadGuestNoticeActor({ requireWritable: true });
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
