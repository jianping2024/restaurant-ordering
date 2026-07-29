import 'server-only';

import { NextResponse } from 'next/server';
import { isRestaurantSuspended } from '@mesa/shared';
import type { PermissionKey } from '@/lib/permissions/registry';
import { requirePermission } from '@/lib/permissions/require';
import { createAdminClient } from '@/lib/supabase/admin';

export type SettingsRestaurantAuthOk = {
  restaurantId: string;
};

export type SettingsRestaurantAuthResult = SettingsRestaurantAuthOk | NextResponse;

/**
 * Permission-based restaurant scope for settings / print-assistant dashboard APIs.
 * Replaces owner_id-only getOwnerRestaurantId (one auth path).
 */
export async function requireSettingsRestaurantAuth(
  permission: PermissionKey,
  options?: { requireWritable?: boolean },
): Promise<SettingsRestaurantAuthResult> {
  const auth = await requirePermission(permission);
  if (auth instanceof NextResponse) return auth;

  if (options?.requireWritable) {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
    }

    const { data: row, error } = await admin
      .from('restaurants')
      .select('suspended_at')
      .eq('id', auth.principal.restaurantId)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ error: 'query_failed' }, { status: 500 });
    }
    if (isRestaurantSuspended(row.suspended_at)) {
      return NextResponse.json({ error: 'restaurant_suspended' }, { status: 403 });
    }
  }

  return { restaurantId: auth.principal.restaurantId };
}
