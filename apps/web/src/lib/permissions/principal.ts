import 'server-only';

import { cache } from 'react';
import type { Principal } from '@/lib/permissions/types';
import type { Capabilities } from '@/lib/permissions/can';
import { loadAuthOwnershipGate } from '@/lib/staff-access';
import { loadStaffMembership } from '@/lib/permissions/restaurant-access';
import { resolveRestaurantMembershipPrincipal } from '@/lib/permissions/restaurant-access-rules';

export type PrincipalWithCapabilities = {
  principal: Principal;
  capabilities: Capabilities;
};

/**
 * @deprecated Store derived from the user (single-store assumption). Use
 * `loadPrincipalForRestaurant(userId, restaurantId)` with the store from the URL.
 * Kept for batch-1 callers only; removed in phase C.
 *
 * Delegates to the shared membership rules. Legacy semantics preserved: no
 * suspension filter here (dashboard shows the suspension banner instead).
 */
export const loadPrincipalWithCapabilities = cache(
  async (): Promise<PrincipalWithCapabilities | null> => {
    const gate = await loadAuthOwnershipGate();
    if (!gate) return null;

    const { auth, ownedRestaurant, staff } = gate;
    const userId = auth.user.id;
    const restaurantId = ownedRestaurant?.id ?? staff?.restaurant_id;
    if (!restaurantId) return null;

    const membership = ownedRestaurant
      ? null
      : await loadStaffMembership(auth.admin, userId, restaurantId);
    const access = resolveRestaurantMembershipPrincipal({
      userId,
      restaurantId,
      owned: ownedRestaurant,
      membership,
    });
    if (!access) return null;
    return { principal: access.principal, capabilities: access.capabilities };
  },
);

/** @deprecated Use `loadPrincipalForRestaurant(userId, restaurantId)`; removed in phase C. */
export async function loadPrincipal(): Promise<Principal | null> {
  const loaded = await loadPrincipalWithCapabilities();
  return loaded?.principal ?? null;
}
