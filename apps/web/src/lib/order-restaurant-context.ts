import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { isRestaurantSuspended, resolveActiveGeoOrderCoords } from '@mesa/shared';
import { normalizeOrderRadiusMeters } from '@/lib/order-radius';
import {
  normalizeBuffetServiceMode,
  type BuffetServiceMode,
} from '@/lib/buffet-service-mode';
import { reconcileRestaurantLicense } from '@/lib/license-materialize';

export type OrderRestaurantMode = 'guest' | 'staff';

export type OrderRestaurantContext = {
  restaurantId: string;
  slug: string;
  buffetServiceMode: BuffetServiceMode;
  geo: {
    latitude: number;
    longitude: number;
    orderRadiusMeters: number;
  } | null;
};

export type ResolveOrderRestaurantResult =
  | { ok: true; restaurant: OrderRestaurantContext }
  | { ok: false; status: number; error: string };

const RESTAURANT_SELECT =
  'id, slug, suspended_at, geo_latitude, geo_longitude, order_radius_meters, feature_flags, buffet_service_mode';

/** Narrow tenant load for orders/append — not the customer menu session loader. */
export async function resolveOrderRestaurant(
  admin: SupabaseClient,
  slug: string,
  mode: OrderRestaurantMode,
): Promise<ResolveOrderRestaurantResult> {
  const { data, error } = await admin
    .from('restaurants')
    .select(RESTAURANT_SELECT)
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, status: 404, error: 'restaurant_not_found' };
  }
  const suspension = await reconcileRestaurantLicense(admin, data.id as string, {
    checkIn: false,
  });
  if (isRestaurantSuspended(suspension?.suspended_at ?? (data.suspended_at as string | null))) {
    return { ok: false, status: 403, error: 'restaurant_suspended' };
  }

  const geoAnchor =
    mode === 'guest'
      ? resolveActiveGeoOrderCoords({
          geo_latitude: data.geo_latitude,
          geo_longitude: data.geo_longitude,
          feature_flags: data.feature_flags,
        })
      : null;
  const geo = geoAnchor
    ? {
        latitude: geoAnchor.latitude,
        longitude: geoAnchor.longitude,
        orderRadiusMeters: normalizeOrderRadiusMeters(data.order_radius_meters),
      }
    : null;

  return {
    ok: true,
    restaurant: {
      restaurantId: data.id as string,
      slug: data.slug as string,
      buffetServiceMode: normalizeBuffetServiceMode(data.buffet_service_mode),
      geo,
    },
  };
}
