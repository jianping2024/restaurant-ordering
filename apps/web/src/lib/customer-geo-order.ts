import {
  resolveActiveGeoOrderCoords,
  type GeoOrderRestrictionFields,
} from '@mesa/shared';
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

async function getBrowserLocation() {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    throw new Error('not-supported');
  }

  const attempt = (options: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  try {
    return await attempt({
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0,
    });
  } catch {
    return attempt({
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 120000,
    });
  }
}

function classifyGeoError(error: unknown): CustomerGeoOrderFailure {
  const geoError = error as GeolocationPositionError | Error;
  if ('code' in geoError && geoError.code === 1) return 'permission_denied';
  if (geoError.message === 'not-supported') return 'not_supported';
  return 'check_failed';
}

/** Resolve optional customer coordinates before append; skips when restriction is off or waiter flow. */
export async function resolveCustomerGeoForOrder(params: {
  restaurant: RestaurantGeoConfig;
  isWaiterFlow: boolean;
  isLocalDevHost: boolean;
}): Promise<CustomerGeoOrderResult> {
  const { restaurant, isWaiterFlow, isLocalDevHost } = params;
  if (isWaiterFlow) return { ok: true };

  const anchor = resolveActiveGeoOrderCoords(restaurant);
  if (!anchor) return { ok: true };

  let position: GeolocationPosition;
  try {
    position = await getBrowserLocation();
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
  const maxMeters = normalizeOrderRadiusMeters(restaurant.order_radius_meters);
  const dist = distanceMeters(latitude, longitude, anchor.latitude, anchor.longitude);

  if (dist > maxMeters) {
    if (isLocalDevHost) {
      return { ok: true, latitude, longitude };
    }
    return { ok: false, reason: 'too_far' };
  }

  return { ok: true, latitude, longitude };
}
