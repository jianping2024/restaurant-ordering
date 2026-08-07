'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { KitchenScreen, Order, PrintStation } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { StaffAuthenticatedShell, type StaffShellContext } from '@/components/staff/StaffAuthenticatedShell';
import { PersonalSettingsMenu } from '@/components/staff/PersonalSettingsMenu';
import { StaffPersonalTopBar } from '@/components/staff/StaffPersonalTopBar';
import { fetchKitchenBoardClient } from '@/lib/staff-board-client';
import {
  buildDashboardTopNavItems,
  dashboardLogoHref,
} from '@/lib/dashboard-top-nav';
import type { CapabilitiesPayload } from '@/lib/permissions/can';
import { topBarRoleLabel } from '@/lib/top-bar-role-label';
import { useRestaurantStaffEntryReconcile } from '@/lib/use-restaurant-staff-entry-reconcile';
import { playCheckoutRequestChime } from '@/lib/checkout-notification-sound';
import { getPrintStationDisplayName } from '@/lib/print-station-admin';
import { KitchenStationPane } from '@/components/kitchen/KitchenStationPane';
import { KITCHEN_SCREEN_TEXT } from '@/components/kitchen/kitchen-screen-labels';
import { KITCHEN_SCREEN_MAX_STATIONS } from '@/lib/kitchen-screen-limits';
import { KITCHEN_READY_AFTER_MINUTES_DEFAULT } from '@/lib/print-agent-config';

function kitchenPaneGridClass(paneCount: number): string {
  if (paneCount <= 1) return 'grid-cols-1';
  if (paneCount === 2) return 'grid-cols-1 lg:grid-cols-2';
  if (paneCount === 3) return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
  return 'grid-cols-1 md:grid-cols-2';
}

const KitchenScreenRealtime = dynamic(
  () =>
    import('@/components/kitchen/KitchenScreenRealtime').then((m) => m.KitchenScreenRealtime),
  { ssr: false },
);

type Props = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    feature_flags?: Record<string, unknown> | null;
  };
  capabilities: CapabilitiesPayload;
  asOwner?: boolean;
  screen: KitchenScreen;
  stations: PrintStation[];
  initialOrders?: Order[];
  initialReadyAfterMinutes?: number;
};

export function KitchenScreenBoard(props: Props) {
  return (
    <StaffAuthenticatedShell
      restaurant={props.restaurant}
      expectedRole="kitchen"
      asOwner={props.asOwner}
    >
      {(ctx) => <KitchenScreenBoardInner {...props} {...ctx} />}
    </StaffAuthenticatedShell>
  );
}

function KitchenScreenBoardInner({
  restaurant,
  capabilities,
  asOwner = false,
  screen,
  stations,
  initialOrders = [],
  initialReadyAfterMinutes = KITCHEN_READY_AFTER_MINUTES_DEFAULT,
  handleSignOut,
  exitLabel,
  confirmBeforeSignOut,
}: Props & StaffShellContext) {
  const { lang } = useLanguage();
  const t = KITCHEN_SCREEN_TEXT[lang];
  const roleLabel = topBarRoleLabel(lang, asOwner ? 'backend_admin' : 'kitchen');
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [readyAfterMinutes, setReadyAfterMinutes] = useState(initialReadyAfterMinutes);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [maximizedStationId, setMaximizedStationId] = useState<string | null>(null);
  const [prepBusyStationId, setPrepBusyStationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevOrderIds = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));
  const supabase = createClient();

  const stationById = new Map(stations.map((s) => [s.id, s]));
  const paneStationIds = screen.station_ids
    .filter((id) => stationById.has(id))
    .slice(0, KITCHEN_SCREEN_MAX_STATIONS);

  const refreshKitchenBoard = useCallback(async () => {
    const board = await fetchKitchenBoardClient(restaurant.slug);
    board.orders.forEach((o) => {
      if (!prevOrderIds.current.has(o.id)) {
        playCheckoutRequestChime();
        prevOrderIds.current.add(o.id);
      }
    });
    setOrders(board.orders);
    setReadyAfterMinutes(board.kitchen_ready_after_minutes);
  }, [restaurant.slug]);

  useRestaurantStaffEntryReconcile(
    true,
    refreshKitchenBoard,
    undefined,
    true,
  );

  // Local clock for effective ready display — no API poll.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const postPrep = async (
    printStationId: string,
    selections: Array<{ order_id: string; item_index: number }>,
  ) => {
    setError(null);
    setPrepBusyStationId(printStationId);
    try {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(restaurant.slug)}/staff/kitchen/prep`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ print_station_id: printStationId, selections }),
        },
      );
      if (!res.ok) {
        setError(t.prepFailed);
        if (res.status === 409) await refreshKitchenBoard();
        return;
      }
      await refreshKitchenBoard();
    } catch {
      setError(t.prepFailed);
    } finally {
      setPrepBusyStationId(null);
    }
  };

  const navItems = buildDashboardTopNavItems({
    shellMode: 'staff',
    capabilities,
    restaurantSlug: restaurant.slug,
  });
  const logoHref = dashboardLogoHref(restaurant.slug, capabilities);

  const visiblePanes =
    maximizedStationId != null
      ? paneStationIds.filter((id) => id === maximizedStationId)
      : paneStationIds;

  return (
    <div className="flex min-h-screen flex-col bg-brand-bg">
      <KitchenScreenRealtime
        supabase={supabase}
        restaurantId={restaurant.id}
        screenId={screen.id}
        onRefresh={refreshKitchenBoard}
      />
      <StaffPersonalTopBar
        logoHref={logoHref}
        restaurantName={restaurant.name}
        navItems={navItems}
        settingsMenu={
          <PersonalSettingsMenu
            roleLabel={roleLabel}
            logoutLabel={exitLabel}
            onSignOut={() => void handleSignOut()}
            confirmSignOut={confirmBeforeSignOut}
            compact
            allowChangePassword
          />
        }
      />
      <div className="min-h-0 flex-1 overflow-x-clip p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/${restaurant.slug}/kitchen`}
            className="text-sm text-brand-text-muted hover:text-brand-text"
          >
            ← {t.backToScreens}
          </Link>
          <h1 className="font-heading text-2xl text-brand-gold">{screen.name}</h1>
        </div>
        {error ? (
          <div className="mesa-alert-warning px-4 py-2 text-sm">{error}</div>
        ) : null}
        {visiblePanes.length === 0 ? (
          <p className="text-brand-text-muted py-16 text-center">{t.noLines}</p>
        ) : (
          <div
            className={`grid min-h-0 flex-1 gap-4 ${kitchenPaneGridClass(visiblePanes.length)}`}
          >
            {visiblePanes.map((stationId) => {
              const station = stationById.get(stationId)!;
              return (
                <KitchenStationPane
                  key={stationId}
                  stationId={stationId}
                  stationName={getPrintStationDisplayName(station, lang)}
                  orders={orders}
                  readyAfterMinutes={readyAfterMinutes}
                  nowMs={nowMs}
                  lang={lang}
                  maximized={maximizedStationId === stationId}
                  canMaximize={paneStationIds.length > 1}
                  onToggleMaximize={() =>
                    setMaximizedStationId((prev) => (prev === stationId ? null : stationId))
                  }
                  onPrep={(selections) => postPrep(stationId, selections)}
                  prepBusy={prepBusyStationId === stationId}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
