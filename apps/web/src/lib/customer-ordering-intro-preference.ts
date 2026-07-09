import type { CustomerOrderingAudience } from '@/lib/customer-ordering-audience';

const KEY_PREFIX = 'mesa-customer-intro-seen:';

export function customerOrderingIntroStorageKey(restaurantSlug: string): string {
  return `${KEY_PREFIX}${restaurantSlug}`;
}

export function hasSeenCustomerOrderingIntro(restaurantSlug: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(customerOrderingIntroStorageKey(restaurantSlug)) === '1';
  } catch {
    return false;
  }
}

export function markCustomerOrderingIntroSeen(restaurantSlug: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(customerOrderingIntroStorageKey(restaurantSlug), '1');
  } catch {
    /* ignore quota / private mode */
  }
}

export type CustomerOrderingIntroEligibility = {
  audience: CustomerOrderingAudience;
  sessionResolved: boolean;
  hasSeenIntro: boolean;
};

/** Guest menu first visit per restaurant — independent of ordering gate or demo mode. */
export function shouldShowCustomerOrderingIntro(
  input: CustomerOrderingIntroEligibility,
): boolean {
  if (input.audience !== 'guest') return false;
  if (!input.sessionResolved) return false;
  if (input.hasSeenIntro) return false;
  return true;
}
