'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { Order } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { StaffRoleToolbar } from '@/components/staff/StaffRoleToolbar';
import { WaiterAuthenticatedShell } from '@/components/waiter/WaiterAuthenticatedShell';
import { useWaiterOrders } from '@/components/waiter/useWaiterOrders';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { buildWaiterTableCard } from '@/components/waiter/waiter-table-card';
import { normalizeRestaurantTableNumbers } from '@/lib/restaurant-table-numbers';

interface Props {
  restaurant: { id: string; name: string; slug: string; table_numbers?: number[] | null };
  tableNumbers?: number[];
  initialOrders?: Order[];
  initialCheckoutRequestedTables?: number[];
  isDemo?: boolean;
}

function WaiterBoardInner({
  restaurant,
  tableNumbers: tableNumbersProp,
  initialOrders = [],
  initialCheckoutRequestedTables = [],
  isDemo = false,
  handleSignOut,
  exitLabel,
}: Props & { handleSignOut: () => void; exitLabel: string }) {
  const { lang } = useLanguage();
  const t = WAITER_TEXT[lang];
  const { orders } = useWaiterOrders(
    restaurant.id,
    initialOrders,
    initialCheckoutRequestedTables,
    true,
  );

  const configuredTables = useMemo(
    () => tableNumbersProp ?? normalizeRestaurantTableNumbers(restaurant.table_numbers),
    [tableNumbersProp, restaurant.table_numbers],
  );

  const allTableCards = useMemo(() => {
    return configuredTables
      .map((table) => buildWaiterTableCard(table, orders))
      .sort((a, b) => {
        const aActive =
          a.pending + a.cooking + a.ready + a.buffetLines.length + a.voidableItems.length + a.voidedItems.length > 0
            ? 1
            : 0;
        const bActive =
          b.pending + b.cooking + b.ready + b.buffetLines.length + b.voidableItems.length + b.voidedItems.length > 0
            ? 1
            : 0;
        if (aActive !== bActive) return bActive - aActive;
        return a.table - b.table;
      });
  }, [configuredTables, orders]);

  const detailHref = (table: number) => (isDemo ? `/demo/waiter/${table}` : `/${restaurant.slug}/waiter/${table}`);

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
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {allTableCards.map((card) => {
          const isActive =
            card.pending + card.cooking + card.ready + card.buffetLines.length + card.voidableItems.length + card.voidedItems.length > 0;
          return (
            <Link
              key={card.table}
              href={detailHref(card.table)}
              className={`group rounded-xl border px-3 py-2 text-left block transition-all duration-150 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg ${
                isActive
                  ? 'border-emerald-500/45 bg-emerald-500/10 shadow-sm shadow-emerald-900/5 hover:border-emerald-500/70 hover:shadow-emerald-900/12'
                  : 'border-brand-border bg-brand-card shadow-sm shadow-black/5 hover:border-brand-gold/50 hover:shadow-black/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-brand-text">{t.table} {card.table}</p>
                <div className="flex items-center gap-1.5">
                  <span
                    title={t.tableLight}
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.85)]' : 'bg-brand-text-muted/55'}`}
                  />
                  {!isActive && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-brand-border text-brand-text-muted">
                      {t.inactive}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[12px] text-brand-text-muted mt-1 transition-colors group-hover:text-brand-gold">
                {t.clickToView}
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
