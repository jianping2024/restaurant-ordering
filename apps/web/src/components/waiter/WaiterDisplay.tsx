'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Order } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { StaffRoleToolbar } from '@/components/staff/StaffRoleToolbar';
import { WaiterAuthenticatedShell } from '@/components/waiter/WaiterAuthenticatedShell';
import { useWaiterOrders } from '@/components/waiter/useWaiterOrders';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { buildWaiterTableCard } from '@/components/waiter/waiter-table-card';
import { ordersForWaiterTableView } from '@/lib/waiter-table-orders';
import { showToast } from '@/components/ui/Toast';
import {
  activeSessionIdByTableIdFromMeta,
  buildWaiterTableCardSubtitle,
  computeWaiterBoardStats,
  demoSessionMetaFromOrders,
} from '@/lib/waiter-board-session';
import {
  checkoutRequestedAtForTable,
  isTableCheckoutRequested,
} from '@/lib/table-checkout-pending';
import {
  compareRestaurantTables,
  tableIdsEqual,
  type RestaurantTableRow,
} from '@/lib/restaurant-tables';

interface Props {
  restaurant: { id: string; name: string; slug: string };
  tables?: RestaurantTableRow[];
  initialOrders?: Order[];
  initialCheckoutRequestedTableIds?: string[];
  isDemo?: boolean;
}

function WaiterBoardInner({
  restaurant,
  tables: tablesProp = [],
  initialOrders = [],
  initialCheckoutRequestedTableIds = [],
  isDemo = false,
  handleSignOut,
  exitLabel,
}: Props & { handleSignOut: () => void; exitLabel: string }) {
  const { lang } = useLanguage();
  const t = WAITER_TEXT[lang];
  const {
    orders,
    checkoutRequestedTableIds,
    sessionMetaByTableId,
    checkoutRequestedAtByTableId,
    tables,
  } = useWaiterOrders(
    restaurant,
    initialOrders,
    initialCheckoutRequestedTableIds,
    tablesProp,
    !isDemo,
  );

  const effectiveSessionMetaByTableId = useMemo(
    () => (isDemo ? demoSessionMetaFromOrders(orders) : sessionMetaByTableId),
    [isDemo, orders, sessionMetaByTableId],
  );
  const activeSessionByTableId = useMemo(
    () => activeSessionIdByTableIdFromMeta(effectiveSessionMetaByTableId),
    [effectiveSessionMetaByTableId],
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const prevCheckoutIdsRef = useRef<string[] | null>(null);
  useEffect(() => {
    const prev = prevCheckoutIdsRef.current;
    prevCheckoutIdsRef.current = checkoutRequestedTableIds;
    if (prev === null) return;

    const newlyPending = checkoutRequestedTableIds.filter(
      (id) => !prev.some((p) => tableIdsEqual(p, id)),
    );
    for (const id of newlyPending) {
      const label = tables.find((row) => tableIdsEqual(row.id, id))?.display_name ?? id;
      showToast(t.checkoutToast.replace('{table}', label), 'info');
    }
  }, [checkoutRequestedTableIds, tables, t.checkoutToast]);

  const allTableCards = useMemo(() => {
    return tables
      .map((table) => {
        const view = ordersForWaiterTableView(table.id, orders, activeSessionByTableId);
        return buildWaiterTableCard(table.id, table.display_name, view);
      })
      .sort((a, b) => {
        const aCheckout = isTableCheckoutRequested(a.tableId, checkoutRequestedTableIds) ? 1 : 0;
        const bCheckout = isTableCheckoutRequested(b.tableId, checkoutRequestedTableIds) ? 1 : 0;
        if (aCheckout !== bCheckout) return bCheckout - aCheckout;

        const aActive = a.orderLines.length > 0 || a.hasBuffet ? 1 : 0;
        const bActive = b.orderLines.length > 0 || b.hasBuffet ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;

        const ta = tables.find((row) => row.id === a.tableId);
        const tb = tables.find((row) => row.id === b.tableId);
        if (ta && tb) return compareRestaurantTables(ta, tb);
        return a.displayName.localeCompare(b.displayName, undefined, { numeric: true });
      });
  }, [tables, orders, activeSessionByTableId, checkoutRequestedTableIds]);

  const boardStats = useMemo(
    () =>
      computeWaiterBoardStats(
        tables.map((table) => table.id),
        effectiveSessionMetaByTableId,
        checkoutRequestedTableIds,
      ),
    [tables, effectiveSessionMetaByTableId, checkoutRequestedTableIds],
  );

  const detailHref = (tableId: string) =>
    (isDemo ? `/demo/waiter/${encodeURIComponent(tableId)}` : `/${restaurant.slug}/waiter/${encodeURIComponent(tableId)}`);

  return (
    <div className="min-h-screen bg-brand-bg p-4">
      {isDemo && (
        <div className="mb-4 rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-3">
          <p className="text-[13px] text-brand-text">
            {t.step}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/demo/menu"
              className="text-[13px] rounded-lg border border-brand-border px-3 py-1.5 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {t.openCustomer}
            </Link>
            <Link
              href="/demo/kitchen"
              className="text-[13px] rounded-lg border border-brand-border px-3 py-1.5 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {t.openKitchen}
            </Link>
            <Link
              href="/demo"
              className="text-[13px] rounded-lg border border-brand-border px-3 py-1.5 text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
            >
              {t.backHub}
            </Link>
          </div>
        </div>
      )}
      <div className="mb-6">
        <StaffRoleToolbar exitLabel={exitLabel} onSignOut={handleSignOut} />
        <h1 className="font-heading text-3xl text-brand-gold">{restaurant.name}</h1>
        <p className="text-brand-text-muted text-sm mt-1">{t.boardTitle}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
          <span className="rounded-full border border-brand-border bg-brand-card px-2.5 py-1 text-brand-text-muted">
            {t.statsTotal.replace('{n}', String(boardStats.total))}
          </span>
          <span className="rounded-full border border-brand-border bg-brand-card px-2.5 py-1 text-brand-text-muted">
            {t.statsIdle.replace('{n}', String(boardStats.idle))}
          </span>
          <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-emerald-900">
            {t.statsOpen.replace('{n}', String(boardStats.open))}
          </span>
          <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-amber-950">
            {t.statsCheckout.replace('{n}', String(boardStats.checkoutPending))}
          </span>
        </div>
        {boardStats.checkoutPending > 0 && (
          <p className="mt-2 text-sm font-semibold text-amber-950">
            {t.checkoutPendingBoardSummary.replace('{n}', String(boardStats.checkoutPending))}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {allTableCards.map((card) => {
          const session = effectiveSessionMetaByTableId[card.tableId];
          const hasOrderActivity = card.orderLines.length > 0 || card.hasBuffet;
          const hasCheckoutRequest = isTableCheckoutRequested(card.tableId, checkoutRequestedTableIds);
          const isActive = !!session || hasOrderActivity || hasCheckoutRequest;
          const subtitle = buildWaiterTableCardSubtitle({
            guestCount: card.guestCount,
            session,
            hasCheckoutRequest,
            lang,
            checkoutRequestedAt: checkoutRequestedAtForTable(
              card.tableId,
              checkoutRequestedAtByTableId,
            ),
            nowMs,
            labels: {
              guestCount: t.guestCount,
              checkoutPendingSubtitle: t.checkoutPendingSubtitle,
              clickToView: t.clickToView,
            },
          });

          const cardClass = hasCheckoutRequest
            ? 'border-amber-500/50 bg-amber-500/10 shadow-sm shadow-amber-900/8 hover:border-amber-500/75 hover:shadow-amber-900/15'
            : isActive
              ? 'border-emerald-500/45 bg-emerald-500/10 shadow-sm shadow-emerald-900/5 hover:border-emerald-500/70 hover:shadow-emerald-900/12'
              : 'border-brand-border bg-brand-card shadow-sm shadow-black/5 hover:border-brand-gold/50 hover:shadow-black/10';

          const dotClass = hasCheckoutRequest
            ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.85)]'
            : isActive
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.85)]'
              : 'bg-brand-text-muted/55';

          return (
            <Link
              key={card.tableId}
              href={detailHref(card.tableId)}
              className={`group rounded-xl border px-3 py-2 text-left block transition-all duration-150 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg ${cardClass}`}
            >
              <div className="flex items-center justify-between gap-1">
                <p className="font-medium text-brand-text">{t.table} {card.displayName}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  {hasCheckoutRequest && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-700 text-white font-semibold shadow-sm">
                      {t.checkoutPendingShort}
                    </span>
                  )}
                  <span
                    title={t.tableLight}
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${dotClass}`}
                  />
                  {!isActive && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-brand-border text-brand-text-muted">
                      {t.inactive}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[12px] text-brand-text-muted mt-1 transition-colors group-hover:text-brand-gold">
                {subtitle}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function WaiterDisplay(props: Props) {
  const { restaurant, isDemo } = props;
  return (
    <WaiterAuthenticatedShell restaurant={restaurant} isDemo={isDemo}>
      {({ handleSignOut, exitLabel }) => (
        <WaiterBoardInner {...props} handleSignOut={handleSignOut} exitLabel={exitLabel} />
      )}
    </WaiterAuthenticatedShell>
  );
}
