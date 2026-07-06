'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { Order } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { StaffPersonalSettingsMenu } from '@/components/staff/StaffPersonalSettingsMenu';
import { WaiterAuthenticatedShell } from '@/components/waiter/WaiterAuthenticatedShell';
import { WaiterBoardOpenTableSheet } from '@/components/waiter/WaiterBoardOpenTableSheet';
import { WaiterBoardCheckoutSheet } from '@/components/waiter/WaiterBoardCheckoutSheet';
import { WaiterBoardTableCard } from '@/components/waiter/WaiterBoardTableCard';
import { useWaiterOrders } from '@/components/waiter/useWaiterOrders';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { showToast } from '@/components/ui/Toast';
import { getMessages } from '@/lib/i18n/messages';
import { resolveWaiterBoardCardAction } from '@/lib/waiter-board-card-action';
import {
  buildWaiterBoardStateContext,
  classifyWaiterTableBoardState,
  computeWaiterBoardStats,
  demoSessionMetaFromOrders,
  filterWaiterBoardTableIds,
  filterWaiterBoardTableIdsBySearch,
  isWaiterTableInCheckout,
  tableMatchesWaiterBoardSearch,
  type WaiterBoardFilter,
  type WaiterTableSessionMeta,
} from '@/lib/waiter-board-session';
import {
  buildWaiterBoardSections,
  type RestaurantTableGroup,
  type RestaurantTableGroupMember,
  type WaiterBoardSection,
} from '@/lib/restaurant-table-groups';
import {
  sortWaiterBoardTableSummaries,
  type WaiterBoardTableSummary,
  waiterBoardSummariesByTableId,
} from '@/lib/waiter-board-snapshot';
import { tableIdsEqual, type RestaurantTableRow } from '@/lib/restaurant-tables';
import type { WaiterBoardOpenTableDefaults } from '@/lib/staff-board';
import { waiterTableHref } from '@/lib/staff-routes';
import { formatCheckoutPinnedSectionTitle } from '@/lib/waiter-board-permissions';
import {
  loadWaiterBoardCollapsedSectionIds,
  saveWaiterBoardCollapsedSectionIds,
} from '@/lib/waiter-board-section-preference';

interface Props {
  restaurant: { id: string; name: string; slug: string };
  asOwner?: boolean;
  /** SSR successfully loaded board — skip mount entry reconcile. */
  hasAuthoritativeSeed?: boolean;
  tables?: RestaurantTableRow[];
  /** Production SSR seed — board read model only. */
  initialTableSummaries?: WaiterBoardTableSummary[];
  /** Demo only — builds board summaries client-side. */
  initialOrders?: Order[];
  initialCheckoutRequestedTableIds?: string[];
  initialSessionMetaByTableId?: Record<string, WaiterTableSessionMeta>;
  initialCheckoutRequestedAtByTableId?: Record<string, string>;
  initialGroups?: RestaurantTableGroup[];
  initialMembers?: RestaurantTableGroupMember[];
  isDemo?: boolean;
  embeddedInDashboard?: boolean;
  restaurantHasActiveBuffets?: boolean;
  initialOpenTableDefaults?: WaiterBoardOpenTableDefaults | null;
}

const BOARD_KPI_ITEMS: {
  filter: WaiterBoardFilter;
  tone: 'amber' | 'emerald' | 'neutral';
  countKey: keyof ReturnType<typeof computeWaiterBoardStats>;
  labelKey: 'filterAll' | 'filterCheckout' | 'filterDining' | 'filterIdle';
  hintKey?: 'kpiCheckoutHint';
}[] = [
  { filter: 'all', tone: 'neutral', countKey: 'total', labelKey: 'filterAll' },
  { filter: 'checkout', tone: 'amber', countKey: 'checkoutPending', labelKey: 'filterCheckout', hintKey: 'kpiCheckoutHint' },
  { filter: 'dining', tone: 'emerald', countKey: 'open', labelKey: 'filterDining' },
  { filter: 'idle', tone: 'neutral', countKey: 'idle', labelKey: 'filterIdle' },
];

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
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left min-w-[6.5rem] flex-1 transition-all hover:shadow-sm ${toneClass} ${activeClass}`}
    >
      <p className="text-2xl font-semibold tabular-nums leading-none">{count}</p>
      <p className="text-[13px] font-medium mt-1.5">{label}</p>
      {hint ? <p className="text-[11px] opacity-80 mt-0.5">{hint}</p> : null}
    </button>
  );
}

function WaiterBoardSectionBlock({
  section,
  visibleTableIds,
  expanded,
  onToggle,
  sectionTableCountLabel,
  children,
}: {
  section: WaiterBoardSection;
  visibleTableIds: string[];
  expanded: boolean;
  onToggle: () => void;
  sectionTableCountLabel: string;
  children: ReactNode;
}) {
  if (visibleTableIds.length === 0) return null;

  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2 mb-3 text-left group rounded-lg -mx-1 px-1 py-0.5 hover:bg-brand-card/60 transition-colors"
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-brand-border/60 bg-brand-bg/60 text-brand-text-muted text-[10px] transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          ▼
        </span>
        <h2 className="text-sm font-medium text-brand-gold flex-1 min-w-0 truncate">
          {section.title}
        </h2>
        <span className="text-[12px] text-brand-text-muted shrink-0 tabular-nums">
          {sectionTableCountLabel}
        </span>
      </button>
      {expanded ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function WaiterBoardInner({
  restaurant,
  hasAuthoritativeSeed = false,
  tables: tablesProp = [],
  initialTableSummaries = [],
  initialOrders = [],
  initialCheckoutRequestedTableIds = [],
  initialSessionMetaByTableId = {},
  initialCheckoutRequestedAtByTableId = {},
  initialGroups = [],
  initialMembers = [],
  isDemo = false,
  embeddedInDashboard = false,
  restaurantHasActiveBuffets = false,
  initialOpenTableDefaults = null,
  handleSignOut,
  exitLabel,
  confirmBeforeSignOut,
}: Props & { handleSignOut: () => void; exitLabel: string; confirmBeforeSignOut: boolean }) {
  const { lang } = useLanguage();
  const t = WAITER_TEXT[lang];
  const tableGroupsI18n = getMessages(lang).tableGroups;
  const {
    tableSummaries,
    checkoutRequestedTableIds,
    sessionMetaByTableId,
    checkoutRequestedAtByTableId,
    tables,
    groups,
    members,
    openTableDefaults,
    refresh,
  } = useWaiterOrders(
    restaurant,
    initialTableSummaries,
    initialCheckoutRequestedTableIds,
    tablesProp,
    !isDemo,
    initialSessionMetaByTableId,
    initialCheckoutRequestedAtByTableId,
    initialGroups,
    initialMembers,
    isDemo ? initialOrders : [],
    hasAuthoritativeSeed,
    restaurantHasActiveBuffets,
    initialOpenTableDefaults,
  );

  const effectiveSessionMetaByTableId = useMemo(
    () => (isDemo ? demoSessionMetaFromOrders(initialOrders) : sessionMetaByTableId),
    [isDemo, initialOrders, sessionMetaByTableId],
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [boardFilter, setBoardFilter] = useState<WaiterBoardFilter>('all');
  const [tableSearch, setTableSearch] = useState('');
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<string>>(() => new Set());
  const [collapsedPrefsHydrated, setCollapsedPrefsHydrated] = useState(false);
  const [openTableTarget, setOpenTableTarget] = useState<{
    tableId: string;
    displayName: string;
  } | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<{ tableId: string } | null>(null);

  useEffect(() => {
    setCollapsedPrefsHydrated(false);
    const saved = loadWaiterBoardCollapsedSectionIds(restaurant.id);
    setCollapsedSectionIds(saved ?? new Set());
    setCollapsedPrefsHydrated(true);
  }, [restaurant.id]);

  useEffect(() => {
    if (!collapsedPrefsHydrated) return;
    saveWaiterBoardCollapsedSectionIds(restaurant.id, collapsedSectionIds);
  }, [restaurant.id, collapsedSectionIds, collapsedPrefsHydrated]);

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

  const summaryByTableId = useMemo(
    () => waiterBoardSummariesByTableId(tableSummaries),
    [tableSummaries],
  );

  const boardStateContext = useMemo(
    () =>
      buildWaiterBoardStateContext(
        effectiveSessionMetaByTableId,
        checkoutRequestedTableIds,
        tableSummaries,
      ),
    [effectiveSessionMetaByTableId, checkoutRequestedTableIds, tableSummaries],
  );

  const checkoutPinnedCards = useMemo(() => {
    const pendingTables = tables.filter((table) =>
      isWaiterTableInCheckout(table.id, effectiveSessionMetaByTableId, checkoutRequestedTableIds),
    );
    const cards = pendingTables
      .map((table) => summaryByTableId.get(table.id))
      .filter((card): card is WaiterBoardTableSummary => !!card);
    return sortWaiterBoardTableSummaries(
      cards,
      tables,
      checkoutRequestedTableIds,
      effectiveSessionMetaByTableId,
    );
  }, [tables, summaryByTableId, checkoutRequestedTableIds, effectiveSessionMetaByTableId]);

  const checkoutPinnedTableIds = useMemo(
    () => new Set(checkoutPinnedCards.map((card) => card.tableId)),
    [checkoutPinnedCards],
  );

  const boardSections = useMemo(
    () => buildWaiterBoardSections(groups, members, tables, tableGroupsI18n.ungrouped),
    [groups, members, tables, tableGroupsI18n.ungrouped],
  );

  const displayNameByTableId = useMemo(
    () => new Map(tables.map((table) => [table.id, table.display_name])),
    [tables],
  );

  const tableSearchTrimmed = tableSearch.trim();

  const boardStats = useMemo(
    () => computeWaiterBoardStats(tables.map((table) => table.id), boardStateContext),
    [tables, boardStateContext],
  );

  const renderTableCard = (card: WaiterBoardTableSummary, pinned = false) => {
    const boardState = classifyWaiterTableBoardState(card.tableId, boardStateContext);
    const detailHref = waiterTableHref(restaurant.slug, card.tableId, {
      isDemo,
      embeddedInDashboard,
    });
    const action = resolveWaiterBoardCardAction({
      boardState,
      embeddedInDashboard,
      restaurantHasActiveBuffets,
      detailHref,
    });

    return (
      <WaiterBoardTableCard
        key={pinned ? `pinned-${card.tableId}` : card.tableId}
        card={card}
        boardState={boardState}
        action={action}
        embeddedInDashboard={embeddedInDashboard}
        session={effectiveSessionMetaByTableId[card.tableId]}
        checkoutRequestedAt={checkoutRequestedAtByTableId[card.tableId] ?? null}
        nowMs={nowMs}
        lang={lang}
        pinned={pinned}
        onOpenTable={() =>
          setOpenTableTarget({ tableId: card.tableId, displayName: card.displayName })
        }
        onOpenCheckout={() => setCheckoutTarget({ tableId: card.tableId })}
        onDisabledClick={() => showToast(t.buffetNoRule, 'info')}
      />
    );
  };

  const renderSectionCards = (tableIds: string[]) => {
    const visibleIds = visibleBoardTableIds(tableIds);
    const cards = visibleIds
      .map((id) => summaryByTableId.get(id))
      .filter((card): card is WaiterBoardTableSummary => !!card);
    const sorted = sortWaiterBoardTableSummaries(
      cards,
      tables,
      checkoutRequestedTableIds,
      effectiveSessionMetaByTableId,
    );
    return sorted.map((card) => renderTableCard(card));
  };

  const sectionTableCountLabel = (count: number) =>
    t.sectionTableCount.replace('{n}', String(count));

  const visibleCheckoutPinnedCards = useMemo(() => {
    if (!tableSearchTrimmed) return checkoutPinnedCards;
    return checkoutPinnedCards.filter((card) =>
      tableMatchesWaiterBoardSearch(card.displayName, tableSearchTrimmed),
    );
  }, [checkoutPinnedCards, tableSearchTrimmed]);

  const showCheckoutPinned = boardFilter === 'all' && visibleCheckoutPinnedCards.length > 0;

  const visibleBoardTableIds = useCallback(
    (tableIds: readonly string[]) => {
      const byStatus = filterWaiterBoardTableIds(
        tableIds,
        boardFilter === 'all' ? 'all' : boardFilter,
        boardStateContext,
      );
      const withoutPinned =
        boardFilter === 'all'
          ? byStatus.filter((id) => !checkoutPinnedTableIds.has(id))
          : byStatus;
      return filterWaiterBoardTableIdsBySearch(
        withoutPinned,
        displayNameByTableId,
        tableSearchTrimmed,
      );
    },
    [
      boardFilter,
      boardStateContext,
      checkoutPinnedTableIds,
      displayNameByTableId,
      tableSearchTrimmed,
    ],
  );

  const toggleSectionCollapsed = (sectionId: string) => {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const hasVisibleBoardContent = useMemo(() => {
    if (showCheckoutPinned) return true;
    return boardSections.some(
      (section) => visibleBoardTableIds(section.tableIds).length > 0,
    );
  }, [
    showCheckoutPinned,
    boardSections,
    visibleBoardTableIds,
  ]);

  const openTableSheetTable = useMemo(() => {
    if (!openTableTarget) return null;
    return tables.find((row) => tableIdsEqual(row.id, openTableTarget.tableId)) ?? null;
  }, [openTableTarget, tables]);

  return (
    <div className={embeddedInDashboard ? '' : 'min-h-screen bg-brand-bg p-4'}>
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
        {!embeddedInDashboard ? (
          <div className="flex justify-end mb-3">
            <StaffPersonalSettingsMenu
              logoutLabel={exitLabel}
              onSignOut={handleSignOut}
              confirmSignOut={confirmBeforeSignOut}
            />
          </div>
        ) : null}
        {!embeddedInDashboard ? (
          <h1 className="font-heading text-3xl text-brand-gold">{restaurant.name}</h1>
        ) : (
          <h1 className="font-heading text-2xl text-brand-gold">{t.boardTitle}</h1>
        )}
        {!embeddedInDashboard ? (
          <p className="text-brand-text-muted text-sm mt-1">{t.boardTitle}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t.boardTitle}>
          {BOARD_KPI_ITEMS.map((item) => (
            <BoardKpiCard
              key={item.filter}
              active={boardFilter === item.filter}
              count={boardStats[item.countKey]}
              label={t[item.labelKey]}
              hint={item.hintKey ? t[item.hintKey] : undefined}
              tone={item.tone}
              onClick={() => {
                setBoardFilter(item.filter);
                void refresh();
              }}
            />
          ))}
        </div>

        <div className="mt-3 relative">
          <input
            type="text"
            role="searchbox"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder={t.searchTablesPlaceholder}
            aria-label={t.searchTables}
            className="w-full bg-brand-card border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 pr-9"
          />
          {tableSearch ? (
            <button
              type="button"
              onClick={() => setTableSearch('')}
              aria-label={t.clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text text-lg leading-none px-1"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      {tableSearchTrimmed && !hasVisibleBoardContent ? (
        <p className="text-sm text-brand-text-muted mb-6">{t.searchTablesEmpty}</p>
      ) : null}

      {showCheckoutPinned ? (
        <section
          className="mb-6 rounded-2xl border-2 border-amber-500/40 bg-amber-500/8 p-4 shadow-sm shadow-amber-900/5"
          aria-label={formatCheckoutPinnedSectionTitle(
            visibleCheckoutPinnedCards.length,
            t.checkoutPinnedTitleWithCount,
          )}
        >
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-amber-950">
              {formatCheckoutPinnedSectionTitle(
                visibleCheckoutPinnedCards.length,
                t.checkoutPinnedTitleWithCount,
              )}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {visibleCheckoutPinnedCards.map((card) => renderTableCard(card, true))}
          </div>
        </section>
      ) : null}

      <div className="space-y-6">
        {boardSections.map((section) => {
          const visibleIds = visibleBoardTableIds(section.tableIds);
          const expanded = !collapsedSectionIds.has(section.id);
          return (
            <WaiterBoardSectionBlock
              key={section.id}
              section={section}
              visibleTableIds={visibleIds}
              expanded={expanded}
              onToggle={() => toggleSectionCollapsed(section.id)}
              sectionTableCountLabel={sectionTableCountLabel(visibleIds.length)}
            >
              {renderSectionCards(section.tableIds)}
            </WaiterBoardSectionBlock>
          );
        })}
      </div>

      <WaiterBoardOpenTableSheet
        open={openTableTarget != null}
        onClose={() => setOpenTableTarget(null)}
        onSuccess={() => void refresh()}
        restaurant={restaurant}
        tableId={openTableTarget?.tableId ?? ''}
        displayName={openTableTarget?.displayName ?? ''}
        table={openTableSheetTable}
        openTableDefaults={openTableDefaults}
        reconcileEnabled={!isDemo}
        lang={lang}
      />

      {embeddedInDashboard ? (
        <WaiterBoardCheckoutSheet
          open={checkoutTarget != null}
          onClose={() => setCheckoutTarget(null)}
          onComplete={() => void refresh()}
          restaurantId={restaurant.id}
          restaurantSlug={restaurant.slug}
          tableId={checkoutTarget?.tableId ?? ''}
        />
      ) : null}
    </div>
  );
}

export function WaiterDisplay(props: Props) {
  const { restaurant, isDemo, embeddedInDashboard, asOwner = false } = props;
  if (embeddedInDashboard) {
    return (
      <WaiterBoardInner
        {...props}
        handleSignOut={() => {}}
        exitLabel=""
        confirmBeforeSignOut={false}
      />
    );
  }
  return (
    <WaiterAuthenticatedShell restaurant={restaurant} asOwner={asOwner} isDemo={isDemo}>
      {({ handleSignOut, exitLabel, confirmBeforeSignOut }) => (
        <WaiterBoardInner
          {...props}
          handleSignOut={handleSignOut}
          exitLabel={exitLabel}
          confirmBeforeSignOut={confirmBeforeSignOut}
        />
      )}
    </WaiterAuthenticatedShell>
  );
}
