'use client';

import { useEffect, useState } from 'react';
import { resolveActiveGeoOrderCoords } from '@mesa/shared';
import { CustomerFullscreenNotice } from '@/components/customer/CustomerFullscreenNotice';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { messageForCustomerGeoFailure } from '@/lib/customer-geo-menu-access';
import {
  isCustomerGeoLocalDevHost,
  resolveCustomerGeoForOrder,
  type CustomerGeoOrderFailure,
} from '@/lib/customer-geo-order';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';
import type { MenuOrderingRestaurant } from '@/components/menu/MenuOrderingController';

type GeoAccessPhase =
  | { kind: 'allowed' }
  | { kind: 'checking' }
  | { kind: 'blocked'; reason: CustomerGeoOrderFailure };

/**
 * Sole guest menu access gate when GPS ordering restriction is on.
 * Blocked → fullscreen notice only (no menu). Refresh re-runs the check.
 */
export function CustomerGeoMenuAccessGate({
  restaurant,
  enabled,
  children,
}: {
  restaurant: MenuOrderingRestaurant;
  /** False for demo / staff-assisted — skip gate entirely. */
  enabled: boolean;
  children: React.ReactNode;
}) {
  const { lang } = useLanguage();
  const t = MENU_PAGE_MESSAGES[lang];
  const needsGate = enabled && resolveActiveGeoOrderCoords(restaurant) != null;
  const [phase, setPhase] = useState<GeoAccessPhase>(() =>
    needsGate ? { kind: 'checking' } : { kind: 'allowed' },
  );

  const geoLat = restaurant.geo_latitude;
  const geoLng = restaurant.geo_longitude;
  const orderRadius = restaurant.order_radius_meters;
  const geoFlag = restaurant.feature_flags?.geo_order_restriction;

  useEffect(() => {
    if (!needsGate) {
      setPhase({ kind: 'allowed' });
      return;
    }

    let cancelled = false;
    setPhase({ kind: 'checking' });

    void resolveCustomerGeoForOrder({
      restaurant: {
        geo_latitude: geoLat,
        geo_longitude: geoLng,
        order_radius_meters: orderRadius,
        feature_flags: restaurant.feature_flags,
      },
      isWaiterFlow: false,
      isLocalDevHost: isCustomerGeoLocalDevHost(),
    }).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setPhase({ kind: 'allowed' });
        return;
      }
      setPhase({ kind: 'blocked', reason: result.reason });
    });

    return () => {
      cancelled = true;
    };
  }, [needsGate, geoLat, geoLng, orderRadius, geoFlag, restaurant.feature_flags]);

  if (!needsGate || phase.kind === 'allowed') {
    return <>{children}</>;
  }

  if (phase.kind === 'checking') {
    return (
      <CustomerFullscreenNotice title={restaurant.name} body={t.locationChecking} />
    );
  }

  return (
    <CustomerFullscreenNotice
      title={messageForCustomerGeoFailure(lang, phase.reason)}
      body={restaurant.name}
    />
  );
}
