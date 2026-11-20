/**
 * Store id that came out of the sole auth entry (multi-store plan §6.2).
 *
 * Service-role (`createAdminClient`) loaders / services take this type for their store
 * parameter, so passing a plain string (body, query, query result, URL) fails to compile.
 * Only `loadPrincipalForRestaurant` (via `resolvePrincipalForRestaurantWith`) and thus
 * `requirePermission(key, restaurantId)` produce it. Edge-safe, no I/O.
 */
export type AuthorizedRestaurantId = string & { readonly __brand: 'AuthorizedRestaurantId' };

/**
 * Sole mint. Callers are restricted by `scripts/agent-gates/check-store-id-source.mjs`
 * (allowed: `staff-gate-db.ts#resolvePrincipalForRestaurantWith`). Never call elsewhere.
 */
export function mintAuthorizedRestaurantId(restaurantId: string): AuthorizedRestaurantId {
  return restaurantId as AuthorizedRestaurantId;
}

/**
 * Store id from a **public** slug resolve (guest catalog / customer APIs).
 * Not interchangeable with `AuthorizedRestaurantId`: no session principal.
 * Sole mint: `mintPublicRestaurantId` (callers restricted by check-store-id-source).
 */
export type PublicRestaurantId = string & { readonly __brand: 'PublicRestaurantId' };

/** Sole mint for public store id. */
export function mintPublicRestaurantId(restaurantId: string): PublicRestaurantId {
  return restaurantId as PublicRestaurantId;
}
