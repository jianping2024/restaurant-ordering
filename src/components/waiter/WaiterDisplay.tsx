'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { Order } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { WaiterAuthenticatedShell } from '@/components/waiter/WaiterAuthenticatedShell';
import { useWaiterOrders } from '@/components/waiter/useWaiterOrders';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { buildWaiterTableCard } from '@/components/waiter/waiter-table-card';

interface Props {
  restaurant: { id: string; name: string; slug: string; waiter_password: string };
  initialOrders: Order[];
  initialCheckoutRequestedTables?: number[];
  isDemo?: boolean;
}

function WaiterBoardInner({
  restaurant,
  initialOrders,
  initialCheckoutRequestedTables = [],
  isDemo = false,
  handleLock,
}: Props & { handleLock: () => void }) {
  const { lang } = useLanguage();
  const t = WAITER_TEXT[lang];
  const { orders } = useWaiterOrders(
    restaurant.id,
    initialOrders,
    initialCheckoutRequestedTables,
    true,
    !!isDemo,
  );

  const tableCards = useMemo(() => {
    return Array.from({ length: 30 }, (_, idx) => idx + 1)
      .map((table) => buildWaiterTableCard(table, orders))
      .filter(
        (card) =>
          card.pending > 0 ||
          card.cooking > 0 ||
          card.ready > 0 ||
          card.voidableItems.length > 0 ||
          card.voidedItems.length > 0,
      )
      .sort((a, b) => a.table - b.table);
  }, [orders]);

  const allTableCards = useMemo(() => {
    return Array.from({ length: 30 }, (_, idx) => idx + 1)
      .map((table) => buildWaiterTableCard(table, orders))
      .sort((a, b) => {
        const aActive =
          a.pending + a.cooking + a.ready + a.voidableItems.length + a.voidedItems.length > 0 ? 1 : 0;
        const bActive =
          b.pending + b.cooking + b.ready + b.voidableItems.length + b.voidedItems.length > 0 ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return a.table - b.table;
      });
  }, [orders]);

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
        <div className="flex justify-end items-center gap-2 mb-3">
          <LanguageSwitcher compact />
          <button
            type="button"
            onClick={handleLock}
            className="text-[12px] px-2 py-1 rounded-md border border-brand-border text-brand-text-muted hover:text-brand-text transition-colors"
          >
            {t.lock}
          </button>
        </div>
        <h1 className="font-heading text-3xl text-brand-gold">{restaurant.name}</h1>
        <p className="text-brand-text-muted text-sm mt-1">{t.boardTitle}</p>
      </div>

      <div className="bg-brand-card border border-brand-border rounded-2xl p-3 mb-4 text-sm text-brand-text-muted">
        {t.allTablesHint}
      </div>

      {tableCards.length === 0 && (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-4 mb-4 text-center text-brand-text-muted">
          {t.empty}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-4">
        {allTableCards.map((card) => {
          const isActive =
            card.pending + card.cooking + card.ready + card.voidableItems.length + card.voidedItems.length > 0;
          return (
            <Link
              key={card.table}
              href={detailHref(card.table)}
              className={`rounded-xl border px-3 py-2 text-left transition-colors block ${
                isActive
                  ? 'border-emerald-500/45 bg-emerald-500/10'
                  : 'border-brand-border bg-brand-card'
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
              <p className="text-[12px] text-brand-text-muted mt-1">{t.clickToView}</p>
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
      {({ handleLock }) => <WaiterBoardInner {...props} handleLock={handleLock} />}
    </WaiterAuthenticatedShell>
  );
}
