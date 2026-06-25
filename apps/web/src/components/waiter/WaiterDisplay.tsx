'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Order } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { StaffRoleToolbar } from '@/components/staff/StaffRoleToolbar';
import { WaiterAuthenticatedShell } from '@/components/waiter/WaiterAuthenticatedShell';
import { useWaiterOrders } from '@/components/waiter/useWaiterOrders';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { buildWaiterTableCard, type WaiterTableCardData } from '@/components/waiter/waiter-table-card';
import { ordersForWaiterTableView } from '@/lib/waiter-table-orders';
import { showToast } from '@/components/ui/Toast';
import { getMessages } from '@/lib/i18n/messages';
import {
  activeSessionIdByTableIdFromMeta,
  buildWaiterTableCardSubtitle,
  classifyWaiterTableBoardState,
  computeWaiterBoardStats,
  demoSessionMetaFromOrders,
  filterWaiterBoardTableIds,
  type WaiterBoardFilter,
  type WaiterTableBoardState,
} from '@/lib/waiter-board-session';
import {
  checkoutRequestedAtForTable,
  isTableCheckoutRequested,
} from '@/lib/table-checkout-pending';
import {
  buildWaiterBoardSections,
  isWaiterTableCheckoutPending,
  sortWaiterTableCards,
} from '@/lib/restaurant-table-groups';
import { tableIdsEqual, type RestaurantTableRow } from '@/lib/restaurant-tables';

interface Props {
  restaurant: { id: string; name: string; slug: string };
  tables?: RestaurantTableRow[];
  initialOrders?: Order[];
  initialCheckoutRequestedTableIds?: string[];
  isDemo?: boolean;
}

const BOARD_FILTERS: WaiterBoardFilter[] = ['all', 'checkout', 'dining', 'idle'];

const STATUS_STYLES: Record<
  WaiterTableBoardState,
  { card: string; badge: string }
> = {
  checkout: {
    card: 'border-amber-500/55 bg-amber-500/12 shadow-md shadow-amber-900/10 hover:border-amber-500/80',
    badge: 'bg-amber-700 text-white',
  },
  dining: {
    card: 'border-emerald-500/50 bg-emerald-500/10 shadow-sm shadow-emerald-900/5 hover:border-emerald-500/75',
    badge: 'bg-emerald-700 text-white',
  },
  idle: {
    card: 'border-brand-border bg-brand-card shadow-sm shadow-black/5 hover:border-brand-gold/50',
    badge: 'bg-brand-border text-brand-text-muted',
  },
};

function WaiterTableCardLink({
  card,
  href,
  checkoutRequestedTableIds,
  checkoutRequestedAtByTableId,
  sessionMetaByTableId,
  nowMs,
  lang,
  pinned = false,
}: {
  card: WaiterTableCardData;
  href: string;
  checkoutRequestedTableIds: string[];
  checkoutRequestedAtByTableId: Record<string, string>;
  sessionMetaByTableId: Record<string, import('@/lib/waiter-board-session').WaiterTableSessionMeta>;
  nowMs: number;
  lang: 'zh' | 'en' | 'pt';
  pinned?: boolean;
}) {
  const t = WAITER_TEXT[lang];
  const session = sessionMetaByTableId[card.tableId];
  const hasCheckoutRequest = isTableCheckoutRequested(card.tableId, checkoutRequestedTableIds);
  const boardState = classifyWaiterTableBoardState(
    card.tableId,
    sessionMetaByTableId,
    checkoutRequestedTableIds,
  );
  const statusLabel =
    boardState === 'checkout'
      ? t.checkoutPendingShort
      : boardState === 'dining'
        ? t.statusDining
        : t.inactive;
  const subtitle = buildWaiterTableCardSubtitle({
    guestCount: card.guestCount,
    sessionTotal: card.sessionTotal,
    session,
    hasCheckoutRequest,
    lang,
    checkoutRequestedAt: checkoutRequestedAtForTable(card.tableId, checkoutRequestedAtByTableId),
    nowMs,
    labels: {
      guestCount: t.guestCount,
      sessionAmount: t.sessionAmount,
      checkoutPendingSubtitle: t.checkoutPendingSubtitle,
      clickToView: t.clickToView,
    },
  });
  const styles = STATUS_STYLES[boardState];

  return (
    <Link
      href={href}
      className={`group rounded-xl border text-left block transition-all duration-150 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg px-3 py-2.5 ${styles.card} ${
        pinned ? 'ring-2 ring-amber-500/35' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-brand-text">
          {t.table} {card.displayName}
        </p>
        <span
          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${styles.badge}`}
        >
          {statusLabel}
        </span>
      </div>
      <p className="text-[12px] text-brand-text-muted mt-1 transition-colors group-hover:text-brand-gold">
        {subtitle}
      </p>
    </Link>
  );
}

function BoardKpiCard({
  active,
  count,
  label,
  hint,
  tone,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  hint?: string;
  tone: 'amber' | 'emerald' | 'neutral';
  onClick: () => void;
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-500/45 bg-amber-500/10 text-amber-950'
      : tone === 'emerald'
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-950'
        : 'border-brand-border bg-brand-card text-brand-text';
  const activeClass = active ? 'ring-2 ring-brand-gold/50 shadow-md' : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left min-w-[6.5rem] flex-1 transition-all hover:shadow-sm ${toneClass} ${activeClass}`}
    >
      <p className="text-2xl font-semibold tabular-nums leading-none">{count}</p>
      <p className="text-[13px] font-medium mt-1.5">{label}</p>
      {hint ? <p className="text-[11px] opacity-80 mt-0.5">{hint}</p> : null}
    </button>
  );
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
  const tableGroupsI18n = getMessages(lang).tableGroups;
  const {
    orders,
    checkoutRequestedTableIds,
    sessionMetaByTableId,
    checkoutRequestedAtByTableId,
    tables,
    groups,
    members,
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
  const [boardFilter, setBoardFilter] = useState<WaiterBoardFilter>('all');

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

  const cardByTableId = useMemo(() => {
    const map = new Map<string, WaiterTableCardData>();
    for (const table of tables) {
      const view = ordersForWaiterTableView(table.id, orders, activeSessionByTableId);
      map.set(table.id, buildWaiterTableCard(table.id, table.display_name, view));
    }
    return map;
  }, [tables, orders, activeSessionByTableId]);

  const checkoutPinnedCards = useMemo(() => {
    const pendingTables = tables.filter((table) =>
      isWaiterTableCheckoutPending(
        table.id,
        checkoutRequestedTableIds,
        effectiveSessionMetaByTableId[table.id],
      ),
    );
    const cards = pendingTables
      .map((table) => cardByTableId.get(table.id))
      .filter((card): card is WaiterTableCardData => !!card);
    return sortWaiterTableCards(
      cards,
      tables,
      checkoutRequestedTableIds,
      effectiveSessionMetaByTableId,
    );
  }, [tables, cardByTableId, checkoutRequestedTableIds, effectiveSessionMetaByTableId]);

  const checkoutPinnedTableIds = useMemo(
    () => new Set(checkoutPinnedCards.map((card) => card.tableId)),
    [checkoutPinnedCards],
  );

  const boardSections = useMemo(
    () => buildWaiterBoardSections(groups, members, tables, tableGroupsI18n.ungrouped),
    [groups, members, tables, tableGroupsI18n.ungrouped],
  );

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

  const filterLabel = (filter: WaiterBoardFilter) => {
    if (filter === 'all') return t.filterAll;
    if (filter === 'checkout') return t.filterCheckout;
    if (filter === 'dining') return t.filterDining;
    return t.filterIdle;
  };

  const renderTableCard = (card: WaiterTableCardData, pinned = false) => (
    <WaiterTableCardLink
      key={pinned ? `pinned-${card.tableId}` : card.tableId}
      card={card}
      href={detailHref(card.tableId)}
      checkoutRequestedTableIds={checkoutRequestedTableIds}
      checkoutRequestedAtByTableId={checkoutRequestedAtByTableId}
      sessionMetaByTableId={effectiveSessionMetaByTableId}
      nowMs={nowMs}
      lang={lang}
      pinned={pinned}
    />
  );

  const visibleSectionTableIds = (tableIds: string[]) => {
    const filtered = filterWaiterBoardTableIds(
      tableIds,
      boardFilter === 'all' ? 'all' : boardFilter,
      effectiveSessionMetaByTableId,
      checkoutRequestedTableIds,
    );
    if (boardFilter !== 'all') return filtered;
    return filtered.filter((id) => !checkoutPinnedTableIds.has(id));
  };

  const renderSectionCards = (tableIds: string[]) => {
    const visibleIds = visibleSectionTableIds(tableIds);
    const cards = visibleIds
      .map((id) => cardByTableId.get(id))
      .filter((card): card is WaiterTableCardData => !!card);
    const sorted = sortWaiterTableCards(
      cards,
      tables,
      checkoutRequestedTableIds,
      effectiveSessionMetaByTableId,
    );
    return sorted.map((card) => renderTableCard(card));
  };

  const showCheckoutPinned = boardFilter === 'all' && checkoutPinnedCards.length > 0;

  return (
    <div className="min-h-screen bg-brand-bg p-4">
      {isDemo && (
        <div className="mb-4 rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-3">
          <p className="text-[13px] text-brand-text">{t.step}</p>
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

        <div className="mt-4 flex flex-wrap gap-2">
          <BoardKpiCard
            active={boardFilter === 'checkout'}
            count={boardStats.checkoutPending}
            label={t.filterCheckout}
            hint={t.kpiCheckoutHint}
            tone="amber"
            onClick={() => setBoardFilter('checkout')}
          />
          <BoardKpiCard
            active={boardFilter === 'dining'}
            count={boardStats.open}
            label={t.filterDining}
            tone="emerald"
            onClick={() => setBoardFilter('dining')}
          />
          <BoardKpiCard
            active={boardFilter === 'idle'}
            count={boardStats.idle}
            label={t.filterIdle}
            tone="neutral"
            onClick={() => setBoardFilter('idle')}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label={t.boardTitle}>
          {BOARD_FILTERS.map((filter) => {
            const active = boardFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setBoardFilter(filter)}
                className={`text-[12px] rounded-full px-3 py-1 border transition-colors ${
                  active
                    ? 'border-brand-gold/50 bg-brand-gold/15 text-brand-text font-medium'
                    : 'border-brand-border bg-brand-card text-brand-text-muted hover:text-brand-text'
                }`}
              >
                {filterLabel(filter)}
              </button>
            );
          })}
        </div>
      </div>

      {showCheckoutPinned ? (
        <section
          className="mb-6 rounded-2xl border-2 border-amber-500/40 bg-amber-500/8 p-4 shadow-sm shadow-amber-900/5"
          aria-label={t.checkoutPinnedTitle}
        >
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-amber-950">{t.checkoutPinnedTitle}</h2>
            <p className="text-[12px] text-amber-900/85 mt-0.5">
              {t.checkoutPendingBoardSummary.replace('{n}', String(checkoutPinnedCards.length))}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {checkoutPinnedCards.map((card) => renderTableCard(card, true))}
          </div>
        </section>
      ) : null}

      <div className="space-y-6">
        {boardSections.map((section) => {
          const visibleIds = visibleSectionTableIds(section.tableIds);
          if (visibleIds.length === 0) return null;
          return (
            <section key={section.id}>
              <h2 className="text-sm font-medium text-brand-gold mb-3">{section.title}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {renderSectionCards(section.tableIds)}
              </div>
            </section>
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
