'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { KitchenScreen, Order, PrintStation } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { StaffAuthenticatedShell, type StaffShellContext } from '@/components/staff/StaffAuthenticatedShell';
import { PersonalSettingsMenu } from '@/components/staff/PersonalSettingsMenu';
import { fetchKitchenBoardClient } from '@/lib/staff-board-client';
import { classifyStaffBoardFetchFailure } from '@/lib/staff-board-fetch-failure';
import { topBarRoleLabel } from '@/lib/top-bar-role-label';
import { useRestaurantStaffEntryReconcile } from '@/lib/use-restaurant-staff-entry-reconcile';
import { playCheckoutRequestChime } from '@/lib/checkout-notification-sound';
import { getPrintStationDisplayName } from '@/lib/print-station-admin';
import { KitchenStationPane } from '@/components/kitchen/KitchenStationPane';
import { KITCHEN_SCREEN_TEXT } from '@/components/kitchen/kitchen-screen-labels';
import { KITCHEN_SCREEN_MAX_STATIONS } from '@/lib/kitchen-screen-limits';
import { KITCHEN_READY_AFTER_MINUTES_DEFAULT } from '@/lib/print-agent-config';
import type { UILanguage } from '@/lib/i18n';

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

const KITCHEN_DEMO_TEXT: Record<
  UILanguage,
  { step: string; openCustomer: string; openWaiter: string; backHub: string }
> = {
  zh: {
    step: '演示：后厨档口大屏 — 勾选菜品点「备餐」。',
    openCustomer: '顾客菜单',
    openWaiter: '楼面看板',
    backHub: '演示首页',
  },
  en: {
    step: 'Demo: station kitchen board — select lines, then Prep.',
    openCustomer: 'Customer menu',
    openWaiter: 'Waiter board',
    backHub: 'Demo hub',
  },
  pt: {
    step: 'Demo: ecrã de cozinha por estação — selecione e prepare.',
    openCustomer: 'Menu cliente',
    openWaiter: 'Quadro salão',
    backHub: 'Início demo',
  },
  es: {
    step: 'Demo: pantalla de cocina por estación — seleccione y prepare.',
    openCustomer: 'Menú cliente',
    openWaiter: 'Panel salón',
    backHub: 'Inicio demo',
  },
  fr: {
    step: 'Démo : écran cuisine par station — sélectionnez puis préparez.',
    openCustomer: 'Menu client',
    openWaiter: 'Tableau salle',
    backHub: 'Accueil démo',
  },
  de: {
    step: 'Demo: Küchen-Screen nach Station — Zeilen wählen, dann Vorbereitung.',
    openCustomer: 'Gästemenu',
    openWaiter: 'Service-Board',
    backHub: 'Demo-Start',
  },
};

type Props = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    feature_flags?: Record<string, unknown> | null;
  };
  asOwner?: boolean;
  isDemo?: boolean;
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
      isDemo={props.isDemo}
    >
      {(ctx) => <KitchenScreenBoardInner {...props} {...ctx} />}
    </StaffAuthenticatedShell>
  );
}

function applyDemoPrep(
  orders: Order[],
  selections: Array<{ order_id: string; item_index: number }>,
): Order[] {
  const nowIso = new Date().toISOString();
  const byOrder = new Map<string, number[]>();
  for (const sel of selections) {
    const list = byOrder.get(sel.order_id) ?? [];
    list.push(sel.item_index);
    byOrder.set(sel.order_id, list);
  }
  return orders.map((order) => {
    const idxs = byOrder.get(order.id);
    if (!idxs?.length) return order;
    const items = order.items.map((item, index) => {
      if (!idxs.includes(index)) return item;
      if (item.item_status === 'voided' || item.item_status === 'done') return item;
      return {
        ...item,
        item_status: 'cooking' as const,
        started_at: item.started_at || nowIso,
      };
    });
    return { ...order, items, updated_at: nowIso, status: 'cooking' };
  });
}

function KitchenScreenBoardInner({
  restaurant,
  asOwner = false,
  isDemo = false,
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
  const demoText = KITCHEN_DEMO_TEXT[lang];
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
    if (isDemo) return;
    try {
      const board = await fetchKitchenBoardClient(restaurant.slug);
      board.orders.forEach((o) => {
        if (!prevOrderIds.current.has(o.id)) {
          playCheckoutRequestChime();
          prevOrderIds.current.add(o.id);
        }
      });
      setOrders(board.orders);
      setReadyAfterMinutes(board.kitchen_ready_after_minutes);
    } catch (err) {
      // Entry reconcile + Realtime call this via void — never throw (stale-while-revalidate).
      const kind = classifyStaffBoardFetchFailure(err);
      console.error('[kitchen-screen] board refresh failed', kind, err);
      if (kind === 'unauthorized') void handleSignOut();
    }
  }, [handleSignOut, isDemo, restaurant.slug]);

  useRestaurantStaffEntryReconcile(
    !isDemo,
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
  ): Promise<boolean> => {
    setError(null);
    setPrepBusyStationId(printStationId);
    try {
      if (isDemo) {
        setOrders((prev) => applyDemoPrep(prev, selections));
        return true;
      }
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
        return false;
      }
      await refreshKitchenBoard();
      return true;
    } catch {
      setError(t.prepFailed);
      return false;
    } finally {
      setPrepBusyStationId(null);
    }
  };

  const maximized = maximizedStationId != null;
  const visiblePanes = maximized
    ? paneStationIds.filter((id) => id === maximizedStationId)
    : paneStationIds;

  const settingsMenu = (
    <PersonalSettingsMenu
      roleLabel={roleLabel}
      logoutLabel={exitLabel}
      onSignOut={() => void handleSignOut()}
      confirmSignOut={confirmBeforeSignOut}
      compact
      allowChangePassword={!isDemo}
    />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden overscroll-x-none bg-brand-bg">
      {!isDemo ? (
        <KitchenScreenRealtime
          supabase={supabase}
          restaurantId={restaurant.id}
          screenId={screen.id}
          onRefresh={refreshKitchenBoard}
        />
      ) : null}

      {/* Split mode only: thin kitchen chrome (no dashboard nav). Maximize hides this entirely. */}
      {!maximized ? (
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-brand-border/70 bg-brand-card px-3 py-2">
          {isDemo ? (
            <>
              <h1 className="shrink-0 font-heading text-2xl text-brand-ink">{screen.name}</h1>
              <p className="min-w-0 flex-1 truncate text-lg text-brand-text-muted">{demoText.step}</p>
              <Link href="/demo/menu" className="text-lg text-brand-text-muted hover:text-brand-text">
                {demoText.openCustomer}
              </Link>
              <Link href="/demo/waiter" className="text-lg text-brand-text-muted hover:text-brand-text">
                {demoText.openWaiter}
              </Link>
              <Link href="/demo" className="text-lg text-brand-text-muted hover:text-brand-text">
                {demoText.backHub}
              </Link>
            </>
          ) : (
            <>
              <Link
                href={`/${restaurant.slug}/kitchen`}
                className="shrink-0 text-lg text-brand-text-muted hover:text-brand-text"
              >
                ← {t.backToScreens}
              </Link>
              <h1 className="min-w-0 flex-1 truncate font-heading text-2xl text-brand-ink">
                {screen.name}
              </h1>
            </>
          )}
          <div className="ml-auto shrink-0">{settingsMenu}</div>
        </header>
      ) : null}

      {error ? (
        <div className="shrink-0 mesa-alert-warning px-4 py-2 text-lg">{error}</div>
      ) : null}

      <div
        className={`min-h-0 flex-1 ${maximized ? 'p-0' : 'p-2'} flex flex-col`}
      >
        {visiblePanes.length === 0 ? (
          <p className="py-16 text-center text-2xl text-brand-text-muted">{t.noLines}</p>
        ) : (
          <div
            className={`grid min-h-0 min-w-0 flex-1 ${maximized ? 'gap-0' : 'gap-2'} ${kitchenPaneGridClass(visiblePanes.length)}`}
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
