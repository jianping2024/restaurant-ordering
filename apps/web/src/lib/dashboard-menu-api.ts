import { NextResponse } from 'next/server';
import { loadMenuManagementContext } from '@/lib/dashboard-access';
import type { MutationError } from '@/lib/dashboard-api-shared';
import {
  dashboardApiError,
  loadWritableFrontdeskContext,
  readJsonBody,
} from '@/lib/dashboard-api-shared';

export type WritableMenuContext = { admin: import('@supabase/supabase-js').SupabaseClient; restaurantId: string };

export type MenuMutationError = MutationError;

export function menuApiError(result: MenuMutationError) {
  return dashboardApiError(result);
}

export { readJsonBody };

export async function loadWritableMenuContext(): Promise<WritableMenuContext | NextResponse> {
  const ctx = await loadMenuManagementContext({ requireWritable: true });
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  return ctx;
}

export { loadWritableFrontdeskContext };
