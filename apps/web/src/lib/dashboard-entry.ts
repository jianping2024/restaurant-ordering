import 'server-only';

import { cookies } from 'next/headers';
import { listAuthorizedRestaurantsForUser } from '@/lib/permissions/restaurant-access';
import { pickLandingRestaurant } from '@/lib/permissions/restaurant-access-rules';
import { LAST_RESTAURANT_COOKIE, parseLastRestaurantCookie } from '@/lib/last-restaurant-cookie';
import { loadStaffIdentity } from '@mesa/shared';
import { loadAuthUserWithAdmin } from '@/lib/staff-access';

/**
 * Where the store-less dashboard entry (`/dashboard`, legacy `/dashboard/*` bookmarks,
 * PWA start URL, unknown / renamed slug) sends this account (plan §6.1, §8.1).
 */
export type DashboardEntryDecision =
  | { kind: 'login' }
  | { kind: 'store'; slug: string }
  | { kind: 'select' }
  | { kind: 'onboarding' };

export async function resolveDashboardEntry(): Promise<DashboardEntryDecision> {
  const auth = await loadAuthUserWithAdmin();
  if (!auth) return { kind: 'login' };

  const restaurants = await listAuthorizedRestaurantsForUser(auth.user.id);
  const lastRestaurantId = parseLastRestaurantCookie(
    cookies().get(LAST_RESTAURANT_COOKIE)?.value,
    auth.user.id,
  );
  const decision = pickLandingRestaurant(restaurants, { lastRestaurantId });
  if (decision.kind === 'store') return { kind: 'store', slug: decision.restaurant.slug };
  if (decision.kind === 'select') return { kind: 'select' };

  // Staff identity without an enterable store (disabled / print agent / no role) → login page.
  if (await loadStaffIdentity(auth.admin, auth.user.id)) return { kind: 'login' };

  return { kind: 'onboarding' };
}
