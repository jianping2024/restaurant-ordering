import 'server-only';

import { NextResponse } from 'next/server';
import { can, type Capabilities } from '@/lib/permissions/can';
import {
  loadPrincipalForRestaurant,
  type AuthorizedRestaurantPrincipal,
} from '@/lib/permissions/restaurant-access';
import type { PermissionKey } from '@/lib/permissions/registry';
import { loadAuthUserWithAdmin } from '@/lib/staff-access';

export type PermissionOk = {
  principal: AuthorizedRestaurantPrincipal['principal'];
  capabilities: Capabilities;
};

export function assertCapability(capabilities: Capabilities, key: PermissionKey): boolean {
  return can(capabilities, key);
}

const unauthorized = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });

/**
 * Session principal for one store without a single-permission check (route decides by
 * principal kind / several capabilities). 401 no session; 403 no access to the store.
 */
export async function requireRestaurantPrincipal(
  restaurantId: string,
): Promise<AuthorizedRestaurantPrincipal | NextResponse> {
  const auth = await loadAuthUserWithAdmin();
  if (!auth) return unauthorized();
  const access = await loadPrincipalForRestaurant(auth.user.id, restaurantId);
  return access ?? NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

/**
 * Cookie-session API gate for one store (store id from the URL slug).
 * 401 unauthenticated; 403 no access to the store or missing the permission.
 */
export async function requirePermission(
  key: PermissionKey,
  restaurantId: string,
): Promise<AuthorizedRestaurantPrincipal | NextResponse> {
  const loaded = await requireRestaurantPrincipal(restaurantId);
  if (loaded instanceof NextResponse) return loaded;
  if (!can(loaded.capabilities, key)) {
    return NextResponse.json({ error: 'forbidden', permission: key }, { status: 403 });
  }
  return loaded;
}

/** Same as `requirePermission` but passes when any one key is granted. */
export async function requireAnyPermission(
  keys: readonly PermissionKey[],
  restaurantId: string,
): Promise<AuthorizedRestaurantPrincipal | NextResponse> {
  const loaded = await requireRestaurantPrincipal(restaurantId);
  if (loaded instanceof NextResponse) return loaded;
  if (!keys.some((key) => can(loaded.capabilities, key))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return loaded;
}
