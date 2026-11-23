/**
 * «上次所在店» cookie (multi-store plan §6.3): `userId:restaurantId`, ~90 days, HttpOnly,
 * SameSite=Lax. Only picks the default store after login / at the store-less entry —
 * never part of auth. Edge-safe; sole writer is middleware on store pages.
 */
export const LAST_RESTAURANT_COOKIE = 'mesa_last_restaurant_id';

export const LAST_RESTAURANT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 90,
};

export function formatLastRestaurantCookie(userId: string, restaurantId: string): string {
  return `${userId}:${restaurantId}`;
}

/** Store id from the cookie, or null when missing / malformed / written for another account. */
export function parseLastRestaurantCookie(
  value: string | null | undefined,
  userId: string,
): string | null {
  if (!value) return null;
  const sep = value.indexOf(':');
  if (sep <= 0) return null;
  const owner = value.slice(0, sep);
  const restaurantId = value.slice(sep + 1);
  if (owner !== userId || !restaurantId) return null;
  return restaurantId;
}
