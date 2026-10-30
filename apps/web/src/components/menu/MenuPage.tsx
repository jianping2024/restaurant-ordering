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
import type { MenuTimeSlot } from '@/lib/menu-time-slot';
import type { CustomerSessionContext } from '@/lib/customer-session-context';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
import type { CartItem, MenuCategory, MenuItem } from '@/types';
import {
  MenuOrderingController,
  type MenuOrderingRestaurant,
} from '@/components/menu/MenuOrderingController';
import { SushiMenuPage } from '@/components/menu/sushi/SushiMenuPage';
import { CustomerMenuCatalogRealtimeLazy } from '@/components/menu/CustomerMenuCatalogRealtimeLazy';
import { useRestaurantStaffEntryReconcile } from '@/lib/use-restaurant-staff-entry-reconcile';
import {
  parseSushiRoundSettingsFromRestaurantRow,
  shouldRenderSushiRoundMenuPage,
} from '@/lib/table-order-round/settings';
import { GuestTableStandaloneTitle } from '@/components/pwa/GuestTableStandaloneTitle';
import { resolveTableOrderingChannel } from '@/lib/instore-takeaway';
import { isRestaurantFeatureEnabled } from '@/lib/restaurant-features';

const EMPTY_MENU_TIME_SLOTS: MenuTimeSlot[] = [];

interface Props {
  restaurant: MenuOrderingRestaurant;
  /** SSR/demo seed for first paint; version seeds client ensure. */
  initialMenuCatalog?: CustomerMenuCatalog | null;
  /** DB `menu_catalog_version` matching `initialMenuCatalog` (0 when unknown). */
  initialMenuCatalogVersion?: number;
  tableId: string;
  displayName: string;
  /** Table currently in the restaurant's is_takeaway group. */
  tableInTakeawayGroup?: boolean;
  orderCooldownSeconds: number;
  initialSessionContext?: CustomerSessionContext | null;
  isDemo?: boolean;
  staffAssisted?: StaffAssistedFlow | null;
}

export function MenuPage({
  restaurant,
  initialMenuCatalog = null,
  initialMenuCatalogVersion = 0,
  tableId,
  displayName,
  tableInTakeawayGroup = false,
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
    seedCustomerMenuCatalogCache(restaurant.id, seededCatalog, initialMenuCatalogVersion);
    setCatalog(seededCatalog);
    setCatalogReady(true);
  }, [restaurant.id, seededCatalog, initialMenuCatalogVersion]);

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

  // SSR seed paints first; still version-reconcile on mount + attention (cheap when unchanged).
  useRestaurantStaffEntryReconcile(Boolean(!isDemo), refreshCatalog, restaurant.id, true);

  const menuItems = catalog?.menuItems ?? [];
  const menuCategories = catalog?.menuCategories ?? [];
  const recommendedItemIds = catalog?.recommendedItemIds ?? [];
  const notePresetCatalog = catalog?.notePresetCatalog ?? { groups: [] };
  const menuTimeSlots = catalog?.menuTimeSlots ?? EMPTY_MENU_TIME_SLOTS;
  const guestListMotionEnabled = catalog?.guestListMotionEnabled === true;
  const restaurantWithNotice = { ...restaurant, guest_ordering_notice: guestOrderingNotice };

  const standaloneTitle =
    !isDemo && tableId ? <GuestTableStandaloneTitle /> : null;

  const catalogRealtime =
    !isDemo ? (
      <CustomerMenuCatalogRealtimeLazy
        restaurantId={restaurant.id}
        enabled
        onRefresh={() => {
          void refreshCatalog();
        }}
      />
    ) : null;

  const orderingChannel = resolveTableOrderingChannel({
    takeawayOrderingEnabled: isRestaurantFeatureEnabled(
      restaurant.feature_flags,
      'takeaway_ordering',
    ),
    tableInTakeawayGroup,
    sessionChannel: initialSessionContext?.active_session?.ordering_channel,
  });

  if (
    orderingChannel !== 'takeaway' &&
    shouldRenderSushiRoundMenuPage({
      buffetServiceMode: restaurant.buffet_service_mode,
      sushiRoundOrderingEnabled: restaurant.sushi_round_ordering_enabled,
      staffAssisted: Boolean(staffAssisted),
    })
  ) {
    return (
      <>
        {standaloneTitle}
        {catalogRealtime}
        <SushiMenuPage
          restaurant={restaurantWithNotice}
          sushiRoundSettings={parseSushiRoundSettingsFromRestaurantRow(restaurant)}
          menuItems={menuItems}
          menuCategories={menuCategories}
          recommendedItemIds={recommendedItemIds}
          menuTimeSlots={menuTimeSlots}
          notePresetCatalog={notePresetCatalog}
          catalogReady={catalogReady}
          guestListMotionEnabled={guestListMotionEnabled}
          tableId={tableId}
          displayName={displayName}
          orderCooldownSeconds={orderCooldownSeconds}
          initialSessionContext={initialSessionContext}
          isDemo={isDemo}
        />
      </>
    );
  }

  return (
    <>
      {standaloneTitle}
      {catalogRealtime}
      <MenuOrderingController
        restaurant={restaurantWithNotice}
        menuItems={menuItems}
        menuCategories={menuCategories}
        recommendedItemIds={recommendedItemIds}
        menuTimeSlots={menuTimeSlots}
        notePresetCatalog={notePresetCatalog}
        catalogReady={catalogReady}
        guestListMotionEnabled={guestListMotionEnabled}
        tableId={tableId}
        displayName={displayName}
        tableInTakeawayGroup={tableInTakeawayGroup}
        orderCooldownSeconds={orderCooldownSeconds}
        initialSessionContext={initialSessionContext}
        isDemo={isDemo}
        staffAssisted={staffAssisted}
        presentationMode="page"
        staffSubmitMode={staffAssisted ? 'navigate' : 'navigate'}
      />
    </>
  );
}

export type { CartItem, MenuCategory, MenuItem };
