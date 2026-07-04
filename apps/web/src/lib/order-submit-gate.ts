import type { StaffAuthContext } from '@/lib/staff-api-auth';
import { verifyOpenTableStaffAuth } from '@/lib/staff-api-auth';
import { distanceMeters } from '@/lib/geo-distance';
import type { OrderRestaurantContext } from '@/lib/order-restaurant-context';

const isDevBypassHost = (host: string) =>
  host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.endsWith('.local');

export type OrderAppendGateBody = {
  latitude?: unknown;
  longitude?: unknown;
};

export type OrderAppendGateResult =
  | { ok: true; staffAuth: StaffAuthContext | null }
  | { ok: false; status: number; error: string };

/** Guest geo fence + staff assisted auth for orders/append. */
export async function verifyOrderAppendGate(params: {
  req: Request;
  restaurant: OrderRestaurantContext;
  waiterFlow: boolean;
  body: OrderAppendGateBody;
}): Promise<OrderAppendGateResult> {
  const { req, restaurant, waiterFlow, body } = params;

  if (waiterFlow) {
    const staffAuth = await verifyOpenTableStaffAuth(req, {
      slug: restaurant.slug,
      restaurantId: restaurant.restaurantId,
    });
    if (!staffAuth) {
      return { ok: false, status: 401, error: 'unauthorized' };
    }
    return { ok: true, staffAuth };
  }

  if (restaurant.geo) {
    const lat = Number(body.latitude);
    const lon = Number(body.longitude);
    const host = req.headers.get('host') || '';
    const devBypass = process.env.NODE_ENV !== 'production' && isDevBypassHost(host);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { ok: false, status: 400, error: 'location_required' };
    }

    const dist = distanceMeters(lat, lon, restaurant.geo.latitude, restaurant.geo.longitude);
    if (dist > restaurant.geo.orderRadiusMeters && !devBypass) {
      return { ok: false, status: 403, error: 'location_too_far' };
    }
  }

  return { ok: true, staffAuth: null };
}
