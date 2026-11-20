import 'server-only';

import { NextResponse } from 'next/server';
import { can, type Capabilities } from '@/lib/permissions/can';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import {
  loadPrincipalForRestaurant,
  type RestaurantPrincipal,
} from '@/lib/permissions/restaurant-access';
import type { PermissionKey } from '@/lib/permissions/registry';
import type { Principal } from '@/lib/permissions/types';
import { loadAuthUserWithAdmin } from '@/lib/staff-access';

export type PermissionOk = {
  principal: Principal;
  capabilities: Capabilities;
};

export function assertCapability(capabilities: Capabilities, key: PermissionKey): boolean {
  return can(capabilities, key);
}

const unauthorized = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });

/**
 * Session user's principal for this store: 401 without a session, 403 when the
 * account has no access to the store. Legacy (no store) → old single-store lookup.
 */
async function loadGatePrincipal(
  restaurantId: string | undefined,
): Promise<PermissionOk | NextResponse> {
  if (restaurantId === undefined) {
    return (await loadPrincipalWithCapabilities()) ?? unauthorized();
  }
  const auth = await loadAuthUserWithAdmin();
  if (!auth) return unauthorized();
  const access = await loadPrincipalForRestaurant(auth.user.id, restaurantId);
  return access ?? NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

/**
 * Cookie-session API gate for one store (store id from the URL slug).
 * 401 unauthenticated; 403 no access to the store or missing the permission.
 */
export function requirePermission(
  key: PermissionKey,
  restaurantId: string,
): Promise<RestaurantPrincipal | NextResponse>;
/** @deprecated Store derived from the user — pass the URL store id. Removed in phase C. */
export function requirePermission(key: PermissionKey): Promise<PermissionOk | NextResponse>;
export async function requirePermission(
  key: PermissionKey,
  restaurantId?: string,
): Promise<PermissionOk | NextResponse> {
  const loaded = await loadGatePrincipal(restaurantId);
  if (loaded instanceof NextResponse) return loaded;
  if (!can(loaded.capabilities, key)) {
    return NextResponse.json({ error: 'forbidden', permission: key }, { status: 403 });
  }
  return loaded;
}

/** Same as `requirePermission` but passes when any one key is granted. */
export function requireAnyPermission(
  keys: readonly PermissionKey[],
  restaurantId: string,
): Promise<RestaurantPrincipal | NextResponse>;
/** @deprecated Store derived from the user — pass the URL store id. Removed in phase C. */
export function requireAnyPermission(
  keys: readonly PermissionKey[],
): Promise<PermissionOk | NextResponse>;
export async function requireAnyPermission(
  keys: readonly PermissionKey[],
  restaurantId?: string,
): Promise<PermissionOk | NextResponse> {
  const loaded = await loadGatePrincipal(restaurantId);
  if (loaded instanceof NextResponse) return loaded;
  if (!keys.some((key) => can(loaded.capabilities, key))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return loaded;
}
