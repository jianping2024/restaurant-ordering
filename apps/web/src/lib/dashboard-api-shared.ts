import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadFrontdeskOperationalContext } from '@/lib/dashboard-access';
import { loadOwnerRestaurantWithSlug } from '@/lib/staff-dashboard-api';

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

export async function loadWritableFrontdeskContext(): Promise<WritableOperationalContext | NextResponse> {
  const ctx = await loadFrontdeskOperationalContext({ requireWritable: true });
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  return ctx;
}

export async function loadWritableOwnerContext(): Promise<
  | { admin: SupabaseClient; restaurantId: string; restaurant: { id: string; name: string; slug: string } }
  | NextResponse
> {
  const loaded = await loadOwnerRestaurantWithSlug({ requireWritable: true });
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }
  return {
    admin: loaded.admin,
    restaurantId: loaded.restaurant.id,
    restaurant: loaded.restaurant,
  };
}

function uniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

export { uniqueViolation };
