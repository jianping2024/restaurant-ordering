import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { unstable_noStore as noStore } from 'next/cache';
import { isRestaurantSuspended } from '@mesa/shared';
import {
  emptyGuestOrderingNotice,
  normalizeGuestOrderingNotice,
} from '@/lib/guest-ordering-notice';
import { reconcileRestaurantLicense } from '@/lib/license-materialize';
import type { CustomerRestaurantRow } from '@/lib/customer-session-context';

type AdminClient = SupabaseClient;

export type CustomerRestaurantGateResult =
  | { kind: 'found'; restaurant: CustomerRestaurantRow }
  | { kind: 'not_found' }
  | { kind: 'suspended'; name: string; reason: string | null };

/** Guest/menu boundary: reconcile then sole suspended_at gate. */
export async function loadCustomerRestaurantGate(
  admin: AdminClient,
  slug: string,
): Promise<CustomerRestaurantGateResult> {
  noStore();

  const { data } = await admin
    .from('restaurants')
    .select(
      'id, name, slug, logo_url, geo_latitude, geo_longitude, order_radius_meters, feature_flags, order_cooldown_seconds, buffet_service_mode, guest_ordering_notice, suspended_at, suspension_reason',
    )
    .eq('slug', slug)
    .maybeSingle();

  if (!data) return { kind: 'not_found' };

  const suspension = await reconcileRestaurantLicense(admin, data.id as string, {
    checkIn: false,
  });
  const suspendedAt = suspension?.suspended_at ?? (data.suspended_at as string | null);
  const suspensionReason =
    suspension?.suspension_reason ?? ((data.suspension_reason as string | null) ?? null);

  if (isRestaurantSuspended(suspendedAt)) {
    return {
      kind: 'suspended',
      name: data.name as string,
      reason: suspensionReason,
    };
  }

  return {
    kind: 'found',
    restaurant: {
      id: data.id as string,
      name: data.name as string,
      slug: data.slug as string,
      logo_url: data.logo_url as string | null | undefined,
      geo_latitude: data.geo_latitude as number | null | undefined,
      geo_longitude: data.geo_longitude as number | null | undefined,
      order_radius_meters: data.order_radius_meters as number | null | undefined,
      feature_flags: data.feature_flags as Record<string, boolean> | null | undefined,
      order_cooldown_seconds: data.order_cooldown_seconds as number | null | undefined,
      buffet_service_mode: data.buffet_service_mode as string | null | undefined,
      guest_ordering_notice: normalizeGuestOrderingNotice(
        data.guest_ordering_notice ?? emptyGuestOrderingNotice(),
      ),
    },
  };
}

/** API helper: 404 when missing, 403 when suspended. */
export async function loadCustomerRestaurantForApi(
  admin: AdminClient,
  slug: string,
): Promise<
  | { ok: true; restaurant: CustomerRestaurantRow }
  | { ok: false; status: number; error: string }
> {
  const gate = await loadCustomerRestaurantGate(admin, slug);
  if (gate.kind === 'not_found') {
    return { ok: false, status: 404, error: 'restaurant_not_found' };
  }
  if (gate.kind === 'suspended') {
    return { ok: false, status: 403, error: 'restaurant_suspended' };
  }
  return { ok: true, restaurant: gate.restaurant };
}
