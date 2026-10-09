import type { CustomerStorefrontBandModel } from '@/components/menu/CustomerStorefrontBand';
import {
  isRestaurantOpenNow,
  normalizeRestaurantBusinessHours,
  restaurantOpenUntilLabel,
  restaurantTodayWindows,
  type RestaurantBusinessHours,
} from '@/lib/restaurant-business-hours';
import { resolveMenuImageDisplayUrl } from '@/lib/menu-image';
import { resolveStorefrontCoverUrl } from '@/lib/restaurant-storefront-image';
import {
  normalizeStorefrontIntro,
  type StorefrontIntroI18n,
} from '@/lib/restaurant-storefront-intro';

export type CustomerStorefrontRestaurantFields = {
  name: string;
  logo_url?: string | null;
  cover_url?: string | null;
  address?: string | null;
  phone?: string | null;
  geo_latitude?: number | null;
  geo_longitude?: number | null;
  business_hours?: unknown;
  storefront_intro?: unknown;
};

function mapsUrlFromRestaurant(r: CustomerStorefrontRestaurantFields): string {
  if (r.geo_latitude != null && r.geo_longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${r.geo_latitude},${r.geo_longitude}`;
  }
  const address = (r.address ?? '').trim();
  if (!address) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Whether the guest shell should mount the storefront band at all. */
export function customerStorefrontShouldShow(r: CustomerStorefrontRestaurantFields): boolean {
  const hours = normalizeRestaurantBusinessHours(r.business_hours);
  const intro = normalizeStorefrontIntro(r.storefront_intro);
  const hasHours = Object.keys(hours.week).length > 0;
  return Boolean(
    (r.cover_url && r.cover_url.trim()) ||
      (r.logo_url && r.logo_url.trim()) ||
      (r.address && r.address.trim()) ||
      (r.phone && r.phone.trim()) ||
      hasHours ||
      intro.pt.trim() ||
      intro.en.trim() ||
      intro.zh.trim(),
  );
}

/** Sole builder: restaurant row → CustomerStorefrontBandModel. */
export function buildCustomerStorefrontBandModel(
  r: CustomerStorefrontRestaurantFields,
  now: Date = new Date(),
): CustomerStorefrontBandModel {
  const hours: RestaurantBusinessHours = normalizeRestaurantBusinessHours(r.business_hours);
  const intro: StorefrontIntroI18n = normalizeStorefrontIntro(r.storefront_intro);
  const openNow = Object.keys(hours.week).length > 0 ? isRestaurantOpenNow(hours, now) : false;

  const weekHours = ([1, 2, 3, 4, 5, 6, 7] as const).map((weekday) => ({
    weekday,
    windows: hours.week[String(weekday) as '1'] ?? [],
  }));

  return {
    name: r.name,
    logoUrl: resolveMenuImageDisplayUrl(r.logo_url),
    coverUrl: resolveStorefrontCoverUrl(r.cover_url),
    intro,
    address: (r.address ?? '').trim(),
    phone: (r.phone ?? '').trim(),
    mapsUrl: mapsUrlFromRestaurant(r),
    todayWindows: restaurantTodayWindows(hours, now),
    weekHours,
    openNow,
    openUntilLabel: restaurantOpenUntilLabel(hours, now),
  };
}
