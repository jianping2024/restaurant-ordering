import {
  resolveActiveGeoOrderCoords,
  type GeoOrderRestrictionFields,
} from '@mesa/shared';
import { getBrowserPositionForGeoFence } from '@/lib/browser-geolocation';
import { distanceMeters } from '@/lib/geo-distance';
import { normalizeOrderRadiusMeters } from '@/lib/order-radius';

export type CustomerGeoOrderFailure =
  | 'permission_denied'
  | 'not_supported'
  | 'check_failed'
  | 'too_far';

export type CustomerGeoOrderResult =
  | { ok: true; latitude?: number; longitude?: number }
  | { ok: false; reason: CustomerGeoOrderFailure };

type RestaurantGeoConfig = GeoOrderRestrictionFields & {
  order_radius_meters?: number | null;
};

/** Reuse entry/submit coords when still within TTL and inside fence. */
export const CUSTOMER_GEO_WARM_TTL_MS = 90_000;

/** Localhost / loopback only — matches server append geo bypass hosts. */
export function isCustomerGeoLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

type WarmGeoSnapshot = {
  latitude: number;
  longitude: number;
  fetchedAt: number;
};

let warmGeoSnapshot: WarmGeoSnapshot | null = null;

function storeWarmGeoSnapshot(latitude: number, longitude: number): void {
  warmGeoSnapshot = { latitude, longitude, fetchedAt: Date.now() };
}

function readWarmGeoSnapshot(): { latitude: number; longitude: number } | null {
  if (!warmGeoSnapshot) return null;
  if (Date.now() - warmGeoSnapshot.fetchedAt > CUSTOMER_GEO_WARM_TTL_MS) {
    warmGeoSnapshot = null;
    return null;
  }
  return {
    latitude: warmGeoSnapshot.latitude,
    longitude: warmGeoSnapshot.longitude,
  };
}

function coordsWithinFence(
  latitude: number,
  longitude: number,
  anchor: { latitude: number; longitude: number },
  orderRadiusMeters: number | null | undefined,
): boolean {
  const maxMeters = normalizeOrderRadiusMeters(orderRadiusMeters);
  return distanceMeters(latitude, longitude, anchor.latitude, anchor.longitude) <= maxMeters;
}

function classifyGeoError(error: unknown): CustomerGeoOrderFailure {
  const geoError = error as GeolocationPositionError | Error;
  if ('code' in geoError && geoError.code === 1) return 'permission_denied';
  if (geoError.message === 'not-supported') return 'not_supported';
  return 'check_failed';
}

function resolveWarmCoordsForAnchor(
  restaurant: RestaurantGeoConfig,
  anchor: { latitude: number; longitude: number },
): { latitude: number; longitude: number } | null {
  const warm = readWarmGeoSnapshot();
  if (!warm) return null;
  if (!coordsWithinFence(warm.latitude, warm.longitude, anchor, restaurant.order_radius_meters)) {
    return null;
  }
  return warm;
}

/** Resolve optional customer coordinates before menu access / append; skips when restriction is off or waiter flow. */
export async function resolveCustomerGeoForOrder(params: {
  restaurant: RestaurantGeoConfig;
  isWaiterFlow: boolean;
  isLocalDevHost: boolean;
}): Promise<CustomerGeoOrderResult> {
  const { restaurant, isWaiterFlow, isLocalDevHost } = params;
  if (isWaiterFlow) return { ok: true };

  const anchor = resolveActiveGeoOrderCoords(restaurant);
  if (!anchor) return { ok: true };

  const warm = resolveWarmCoordsForAnchor(restaurant, anchor);
  if (warm) {
    return { ok: true, latitude: warm.latitude, longitude: warm.longitude };
  }

  let position: GeolocationPosition;
  try {
    position = await getBrowserPositionForGeoFence();
  } catch (error) {
    if (isLocalDevHost) {
      return {
        ok: true,
        latitude: anchor.latitude,
        longitude: anchor.longitude,
      };
    }
    return { ok: false, reason: classifyGeoError(error) };
  }

  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;

  if (!coordsWithinFence(latitude, longitude, anchor, restaurant.order_radius_meters)) {
    if (isLocalDevHost) {
      return { ok: true, latitude, longitude };
    }
    return { ok: false, reason: 'too_far' };
  }

  storeWarmGeoSnapshot(latitude, longitude);
  return { ok: true, latitude, longitude };
}
