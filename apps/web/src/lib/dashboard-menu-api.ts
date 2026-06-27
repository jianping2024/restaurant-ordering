import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadMenuManagementContext } from '@/lib/dashboard-access';
import type { MenuMutationError } from '@/lib/dashboard-menu-server';

export type WritableMenuContext = { admin: SupabaseClient; restaurantId: string };

export function menuApiError(result: MenuMutationError) {
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

export async function loadWritableMenuContext(): Promise<WritableMenuContext | NextResponse> {
  const ctx = await loadMenuManagementContext({ requireWritable: true });
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  return ctx;
}
