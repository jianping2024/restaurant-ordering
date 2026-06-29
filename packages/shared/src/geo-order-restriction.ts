const GEO_ORDER_RESTRICTION_FLAG = 'geo_order_restriction';

export type GeoOrderRestrictionFields = {
  geo_latitude?: number | null;
  geo_longitude?: number | null;
  feature_flags?: unknown;
};

function readStoredFlag(featureFlags: unknown): boolean | undefined {
  if (!featureFlags || typeof featureFlags !== 'object' || Array.isArray(featureFlags)) {
    return undefined;
  }
  const value = (featureFlags as Record<string, unknown>)[GEO_ORDER_RESTRICTION_FLAG];
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Dashboard toggle state.
 * - Explicit flag wins.
 * - Legacy restaurants with coordinates default to on.
 * - Explicit on without coordinates stays on (owner still filling the form).
 */
export function readGeoOrderRestrictionEnabled(
  featureFlags: unknown,
  hasCoordinates: boolean,
): boolean {
  const stored = readStoredFlag(featureFlags);
  if (stored != null) return stored;
  return hasCoordinates;
}

/** Customer order enforcement: requires coordinates and flag not explicitly off. */
export function isGeoOrderRestrictionActive(params: {
  geoLatitude: number | null | undefined;
  geoLongitude: number | null | undefined;
  featureFlags?: unknown;
}): boolean {
  const { geoLatitude, geoLongitude, featureFlags } = params;
  if (geoLatitude == null || geoLongitude == null) return false;
  return readStoredFlag(featureFlags) !== false;
}

export function isGeoOrderRestrictionActiveForRestaurant(
  restaurant: GeoOrderRestrictionFields,
): boolean {
  return isGeoOrderRestrictionActive({
    geoLatitude: restaurant.geo_latitude,
    geoLongitude: restaurant.geo_longitude,
    featureFlags: restaurant.feature_flags,
  });
}

/** Restaurant anchor coordinates when restriction is active; otherwise null. */
export function resolveActiveGeoOrderCoords(
  restaurant: GeoOrderRestrictionFields,
): { latitude: number; longitude: number } | null {
  if (!isGeoOrderRestrictionActiveForRestaurant(restaurant)) return null;
  return {
    latitude: restaurant.geo_latitude as number,
    longitude: restaurant.geo_longitude as number,
  };
}

export function mergeGeoOrderRestrictionFlag(
  currentFlags: unknown,
  enabled: boolean,
): Record<string, unknown> {
  const base =
    currentFlags && typeof currentFlags === 'object' && !Array.isArray(currentFlags)
      ? { ...(currentFlags as Record<string, unknown>) }
      : {};
  base[GEO_ORDER_RESTRICTION_FLAG] = enabled;
  return base;
}
