'use client';

import { useEffect, useState } from 'react';
import {
  reconcileCustomerMenuCatalogOnEntry,
  seedCustomerMenuCatalogCache,
  type CustomerMenuCatalog,
} from '@/lib/customer-menu-catalog-client-cache';
import { reconcileGuestOrderingNoticeOnEntry } from '@/lib/guest-ordering-notice-client';
import type { GuestOrderingNotice } from '@/lib/guest-ordering-notice';
import type { CustomerSessionContext } from '@/lib/customer-session-context';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
import type { CartItem, MenuCategory, MenuItem } from '@/types';
import {
  MenuOrderingController,
  type MenuOrderingRestaurant,
} from '@/components/menu/MenuOrderingController';

interface Props {
  restaurant: MenuOrderingRestaurant;
  /** Demo/seed path — skips client catalog fetch. */
  initialMenuCatalog?: CustomerMenuCatalog | null;
  tableId: string;
  displayName: string;
  orderCooldownSeconds: number;
  initialSessionContext?: CustomerSessionContext | null;
  isDemo?: boolean;
  staffAssisted?: StaffAssistedFlow | null;
}

export function MenuPage({
  restaurant,
  initialMenuCatalog = null,
  tableId,
  displayName,
  orderCooldownSeconds,
  initialSessionContext = null,
  isDemo,
  staffAssisted = null,
}: Props) {
  const seededCatalog = initialMenuCatalog ?? null;
  const [catalog, setCatalog] = useState<CustomerMenuCatalog | null>(seededCatalog);
  const [catalogReady, setCatalogReady] = useState(Boolean(seededCatalog));
  const [guestOrderingNotice, setGuestOrderingNotice] = useState<GuestOrderingNotice | null>(
    restaurant.guest_ordering_notice ?? null,
  );

  useEffect(() => {
    if (isDemo) return;

    let cancelled = false;
    void reconcileGuestOrderingNoticeOnEntry({
      slug: restaurant.slug,
      seed: restaurant.guest_ordering_notice,
    }).then((notice) => {
      if (!cancelled) setGuestOrderingNotice(notice);
    });

    return () => {
      cancelled = true;
    };
  }, [isDemo, restaurant.guest_ordering_notice, restaurant.slug]);

  useEffect(() => {
    if (seededCatalog) {
      seedCustomerMenuCatalogCache(restaurant.id, seededCatalog);
      setCatalog(seededCatalog);
      setCatalogReady(true);
      return;
    }

    let cancelled = false;
    const { initial, ready } = reconcileCustomerMenuCatalogOnEntry({
      restaurantId: restaurant.id,
      slug: restaurant.slug,
    });

    if (initial) {
      setCatalog(initial);
      setCatalogReady(true);
    }

    void ready
      .then((next) => {
        if (!cancelled) {
          setCatalog(next);
          setCatalogReady(true);
        }
      })
      .catch(() => {
        if (!cancelled && !initial) {
          setCatalogReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [restaurant.id, restaurant.slug, seededCatalog]);

  const menuItems = catalog?.menuItems ?? [];
  const menuCategories = catalog?.menuCategories ?? [];

  return (
    <MenuOrderingController
      restaurant={{ ...restaurant, guest_ordering_notice: guestOrderingNotice }}
      menuItems={menuItems}
      menuCategories={menuCategories}
      catalogReady={catalogReady}
      tableId={tableId}
      displayName={displayName}
      orderCooldownSeconds={orderCooldownSeconds}
      initialSessionContext={initialSessionContext}
      isDemo={isDemo}
      staffAssisted={staffAssisted}
      presentationMode="page"
      staffSubmitMode={staffAssisted ? 'navigate' : 'navigate'}
    />
  );
}

export type { CartItem, MenuCategory, MenuItem };
