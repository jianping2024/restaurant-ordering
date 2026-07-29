import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadDashboardOperationalContext } from '@/lib/dashboard-operational-load';
import type { PermissionKey } from '@/lib/permissions/registry';
import { requireSettingsRestaurantAuth } from '@/lib/settings-restaurant-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export type MutationError = { error: string; message?: string; status: number };

export type WritableOperationalContext = { admin: SupabaseClient; restaurantId: string };

export function dashboardApiError(result: MutationError) {
  return NextResponse.json(
    { error: result.error, message: result.message },
    { status: result.status },
  );
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown> | NextResponse> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
}

export async function loadWritableOperationalContext(
  permission: PermissionKey,
): Promise<WritableOperationalContext | NextResponse> {
  const ctx = await loadDashboardOperationalContext(permission, { requireWritable: true });
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  return ctx;
}

export async function loadWritableOwnerContext(): Promise<
  | { admin: SupabaseClient; restaurantId: string; restaurant: { id: string; name: string; slug: string } }
  | NextResponse
> {
  const auth = await requireSettingsRestaurantAuth('settings.buffet.manage', { requireWritable: true });
  if (auth instanceof NextResponse) return auth;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: restaurant, error } = await admin
    .from('restaurants')
    .select('id, name, slug')
    .eq('id', auth.restaurantId)
    .maybeSingle();

  if (error || !restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
  }

  return {
    admin,
    restaurantId: restaurant.id as string,
    restaurant: restaurant as { id: string; name: string; slug: string },
  };
}

function uniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

export { uniqueViolation };
