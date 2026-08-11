'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  peekCustomerMenuCatalogCache,
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
import { useRestaurantStaffEntryReconcile } from '@/lib/use-restaurant-staff-entry-reconcile';

interface Props {
  restaurant: MenuOrderingRestaurant;
  /** SSR/demo seed — skips mount catalog reconcile when present. */
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
    if (!seededCatalog) return;
    seedCustomerMenuCatalogCache(restaurant.id, seededCatalog);
    setCatalog(seededCatalog);
    setCatalogReady(true);
  }, [restaurant.id, seededCatalog]);

  const refreshCatalog = useCallback(() => {
    const { initial, ready } = reconcileCustomerMenuCatalogOnEntry({
      restaurantId: restaurant.id,
      slug: restaurant.slug,
    });
    if (initial) {
      setCatalog(initial);
      setCatalogReady(true);
    }
    return ready
      .then((next) => {
        setCatalog(next);
        setCatalogReady(true);
      })
      .catch(() => {
        if (!peekCustomerMenuCatalogCache(restaurant.id)) {
          setCatalogReady(true);
        }
      });
  }, [restaurant.id, restaurant.slug]);

  useRestaurantStaffEntryReconcile(
    Boolean(!isDemo && !seededCatalog),
    refreshCatalog,
    restaurant.id,
    true,
  );

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
