import 'server-only';

import { listAuthorizedRestaurantsForUser } from '@/lib/permissions/restaurant-access';
import { loadStaffIdentity } from '@mesa/shared';
import { loadAuthUserWithAdmin } from '@/lib/staff-access';

/**
 * Where the store-less dashboard entry (`/dashboard`, legacy `/dashboard/*` bookmarks,
 * PWA start URL) sends this account. Batch 1: every account has one store.
 */
export type DashboardEntryDecision =
  | { kind: 'login' }
  | { kind: 'store'; slug: string }
  | { kind: 'onboarding' };

/**
 * Store the entry lands on: the first authorized store (suspended stores sort last, and
 * still open with the suspension banner — batch 1 keeps current behavior).
 */
export function pickEnterableStore<T>(restaurants: T[]): T | null {
  return restaurants[0] ?? null;
}

export async function resolveDashboardEntry(): Promise<DashboardEntryDecision> {
  const auth = await loadAuthUserWithAdmin();
  if (!auth) return { kind: 'login' };

  const restaurants = await listAuthorizedRestaurantsForUser(auth.user.id);
  const target = pickEnterableStore(restaurants);
  if (target) return { kind: 'store', slug: target.slug };

  // Staff identity without an enterable store (disabled / print agent / no role) → login page.
  if (await loadStaffIdentity(auth.admin, auth.user.id)) return { kind: 'login' };

  return { kind: 'onboarding' };
}
