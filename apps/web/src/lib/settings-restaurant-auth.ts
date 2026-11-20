import 'server-only';
import type { AuthorizedRestaurantId } from '@/lib/permissions/authorized-restaurant-id';

import { NextResponse } from 'next/server';
import { isRestaurantSuspended } from '@mesa/shared';
import type { PermissionKey } from '@/lib/permissions/registry';
import { requirePermission } from '@/lib/permissions/require';
import type { AuthorizedRestaurantPrincipal } from '@/lib/permissions/restaurant-access-rules';
import { createAdminClient } from '@/lib/supabase/admin';

export type SettingsRestaurantAuthOk = {
  restaurantId: AuthorizedRestaurantId;
};

export type SettingsRestaurantAuthResult = SettingsRestaurantAuthOk | NextResponse;

/** @deprecated Store-less result of the print-agent legacy overload; removed in phase C. */
export type LegacySettingsRestaurantAuthResult = { restaurantId: string } | NextResponse;

/**
 * Permission-based restaurant scope for settings / print-assistant dashboard APIs.
 * Replaces owner_id-only getOwnerRestaurantId (one auth path).
 */
export function requireSettingsRestaurantAuth(
  permission: PermissionKey,
  restaurantId: string,
  options?: { requireWritable?: boolean },
): Promise<SettingsRestaurantAuthResult>;
/**
 * @deprecated Store derived from the user. Only the store-less `/api/print-agent/*`
 * dashboard routes still use this (outside the batch-1 route move); removed in phase C.
 */
export function requireSettingsRestaurantAuth(
  permission: PermissionKey,
  options?: { requireWritable?: boolean },
): Promise<LegacySettingsRestaurantAuthResult>;
export async function requireSettingsRestaurantAuth(
  permission: PermissionKey,
  restaurantIdOrOptions?: string | { requireWritable?: boolean },
  maybeOptions?: { requireWritable?: boolean },
): Promise<LegacySettingsRestaurantAuthResult> {
  const restaurantId = typeof restaurantIdOrOptions === 'string' ? restaurantIdOrOptions : undefined;
  const options = typeof restaurantIdOrOptions === 'string' ? maybeOptions : restaurantIdOrOptions;
  const auth =
    restaurantId === undefined
      ? await requirePermission(permission)
      : await requirePermission(permission, restaurantId);
  if (auth instanceof NextResponse) return auth;
  // Store overload: branded id from the auth gate. Legacy overload: user-derived id.
  const scopedId: string =
    restaurantId === undefined
      ? auth.principal.restaurantId
      : (auth as AuthorizedRestaurantPrincipal).restaurantId;

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
      .eq('id', scopedId)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json({ error: 'query_failed' }, { status: 500 });
    }
    if (isRestaurantSuspended(row.suspended_at)) {
      return NextResponse.json({ error: 'restaurant_suspended' }, { status: 403 });
    }
  }

  return { restaurantId: scopedId };
}
