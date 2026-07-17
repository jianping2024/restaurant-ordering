'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Order } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { WaiterBoardOpenTableSheet } from '@/components/waiter/WaiterBoardOpenTableSheet';
import { WaiterBoardCheckoutSheet } from '@/components/waiter/WaiterBoardCheckoutSheet';
import { WaiterBoardTableCard } from '@/components/waiter/WaiterBoardTableCard';
import { WaiterBoardPartySections, type WaiterBoardPartySectionHandle } from '@/components/waiter/WaiterBoardPartySections';
import { useWaiterBoardOptional } from '@/components/dashboard/WaiterBoardProvider';
import { useWaiterOrders } from '@/components/waiter/useWaiterOrders';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { Input } from '@/components/ui/Input';
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
} from '@/lib/restaurant-table-groups';
import {
  tablePartyMemberTableIds,
  type TablePartyGroup,
  type TablePartyGroupMember,
} from '@/lib/table-party-groups';
import { buildVisibleWaiterBoardPartyLanes } from '@/lib/waiter-board-party-lanes';
import {
  sortWaiterBoardTableSummaries,
  type WaiterBoardTableSummary,
  waiterBoardSummariesByTableId,
} from '@/lib/waiter-board-snapshot';
import { tableIdsEqual, type RestaurantTableRow } from '@/lib/restaurant-tables';
import type { WaiterBoardOpenTableDefaults } from '@/lib/staff-board';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import { waiterTableHref } from '@/lib/staff-routes';
import { formatCheckoutPinnedSectionTitle } from '@/lib/waiter-board-permissions';
import {
  floorLaneKey,
  loadWaiterBoardSelectedLaneKey,
  parseWaiterBoardLaneKey,
  partyLaneKey,
  resolveWaiterBoardSelectedLaneKey,
  saveWaiterBoardSelectedLaneKey,
  type WaiterBoardLaneKey,
} from '@/lib/waiter-board-section-preference';
import {
  WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS,
  WAITER_BOARD_TABLES_GRID_CLASS,
} from '@/lib/waiter-board-card-layout';
import {
  WAITER_BOARD_FILTER_KPI_ICON_CLASS,
  WAITER_BOARD_FILTER_KPI_TONE,
  WAITER_BOARD_LANE_CHROME,
  waiterBoardKpiChromeClass,
  waiterBoardKpiToneClass,
  waiterBoardType,
} from '@/lib/waiter-board-card-theme';
import { WAITER_BOARD_KPI_ICON_BY_FILTER } from '@/components/waiter/waiter-board-kpi-icons';

interface Props {
  restaurant: { id: string; name: string; slug: string };
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
  initialParties?: TablePartyGroup[];
  initialPartyMembers?: TablePartyGroupMember[];
  isDemo?: boolean;
  embeddedInDashboard?: boolean;
  initialOpenTableDefaults?: WaiterBoardOpenTableDefaults | null;
}

const BOARD_KPI_ITEMS: {
  filter: WaiterBoardFilter;
  countKey: keyof ReturnType<typeof computeWaiterBoardStats>;
  labelKey: 'filterAll' | 'filterCheckout' | 'filterDining' | 'filterIdle';
  hintKey?: 'kpiCheckoutHint';
}[] = [
  { filter: 'all', countKey: 'total', labelKey: 'filterAll' },
  { filter: 'checkout', countKey: 'checkoutPending', labelKey: 'filterCheckout', hintKey: 'kpiCheckoutHint' },
  { filter: 'dining', countKey: 'open', labelKey: 'filterDining' },
  { filter: 'idle', countKey: 'idle', labelKey: 'filterIdle' },
];

function BoardKpiCard({
  active,
  count,
  label,
  hint,
  filter,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  hint?: string;
  filter: WaiterBoardFilter;
  onClick: () => void;
}) {
  const toneClass = waiterBoardKpiToneClass(WAITER_BOARD_FILTER_KPI_TONE[filter]);
  const surfaceClass = active ? waiterBoardKpiChromeClass(true) : toneClass;
  const Icon = WAITER_BOARD_KPI_ICON_BY_FILTER[filter];
  const iconClass = [
    waiterBoardType.kpiIcon,
    active ? 'text-inherit' : WAITER_BOARD_FILTER_KPI_ICON_CLASS[filter],
  ].join(' ');

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left min-w-[6.5rem] flex-1 transition-all hover:shadow-sm ${surfaceClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={waiterBoardType.kpiCount}>{count}</p>
        <Icon className={iconClass} />
      </div>
      <p className={waiterBoardType.kpiLabel}>{label}</p>
      {hint ? <p className={waiterBoardType.kpiHint}>{hint}</p> : null}
    </button>
  );
}

function BoardLaneTab({
  active,
  label,
  countLabel,
  onClick,
}: {
  active: boolean;
  label: string;
  countLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`${WAITER_BOARD_LANE_CHROME.base} ${
        active ? WAITER_BOARD_LANE_CHROME.active : WAITER_BOARD_LANE_CHROME.idle
      }`}
    >
      <span className={waiterBoardType.laneLabel}>{label}</span>
      <span className={waiterBoardType.laneMeta}>{countLabel}</span>
    </button>
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
  initialParties = [],
  initialPartyMembers = [],
  isDemo = false,
  embeddedInDashboard = false,
  initialOpenTableDefaults = null,
}: Props) {
  const { lang } = useLanguage();
  const t = WAITER_TEXT[lang];
  const tableGroupsI18n = getMessages(lang).tableGroups;
  const dashboardBoard = useWaiterBoardOptional();
  const standaloneBoard = useWaiterOrders(
    restaurant,
    initialTableSummaries,
    initialCheckoutRequestedTableIds,
    tablesProp,
    !isDemo && !embeddedInDashboard,
    initialSessionMetaByTableId,
    initialCheckoutRequestedAtByTableId,
    initialGroups,
    initialMembers,
    isDemo ? initialOrders : [],
    hasAuthoritativeSeed,
    initialOpenTableDefaults,
    initialParties,
    initialPartyMembers,
  );

  if (embeddedInDashboard && !dashboardBoard) {
    throw new Error('WaiterDisplay embedded mode requires WaiterBoardProvider');
  }

  const {
    tableSummaries,
    checkoutRequestedTableIds,
    sessionMetaByTableId,
    checkoutRequestedAtByTableId,
    tables,
    groups,
    members,
    parties,
    partyMembers,
    openTableDefaults,
    supportsBuffetOpenTable,
    refresh,
    applyPartyState,
    applySessionRelocationPatch,
    applyBoardFromPublished,
    applyOpenTableToBoard,
    refreshBoardAfterStaffMutation,
  } = embeddedInDashboard
    ? dashboardBoard!
    : {
        ...standaloneBoard,
        applyOpenTableToBoard: undefined,
        refreshBoardAfterStaffMutation: undefined,
      };

  const handleOpenTableSuccess = useCallback(
    (model: WaiterTablePageModel) => {
      if (applyOpenTableToBoard) {
        applyOpenTableToBoard(model);
        return;
      }
      applyBoardFromPublished();
    },
    [applyBoardFromPublished, applyOpenTableToBoard],
  );

  const handleOpenTableStaleBoard = useCallback(() => {
    void refresh();
  }, [refresh]);

  const effectiveSessionMetaByTableId = useMemo(
    () => (isDemo ? demoSessionMetaFromOrders(initialOrders) : sessionMetaByTableId),
    [isDemo, initialOrders, sessionMetaByTableId],
  );
  // Stable SSR/hydration seed — real clock starts after mount (avoids duration text mismatch).
  const [nowMs, setNowMs] = useState(0);
  const [boardFilter, setBoardFilter] = useState<WaiterBoardFilter>('all');
  const [tableSearch, setTableSearch] = useState('');
  const [selectedLaneKey, setSelectedLaneKey] = useState<WaiterBoardLaneKey | null>(null);
  const [lanePrefsHydrated, setLanePrefsHydrated] = useState(false);
  const [partyBusy, setPartyBusy] = useState(false);
  const partyActionsRef = useRef<WaiterBoardPartySectionHandle>(null);
  const [openTableTarget, setOpenTableTarget] = useState<{
    tableId: string;
    displayName: string;
  } | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<{ tableId: string } | null>(null);

  useEffect(() => {
    setLanePrefsHydrated(false);
    setSelectedLaneKey(loadWaiterBoardSelectedLaneKey(restaurant.id));
    setLanePrefsHydrated(true);
  }, [restaurant.id]);

  useEffect(() => {
    if (!lanePrefsHydrated) return;
    saveWaiterBoardSelectedLaneKey(restaurant.id, selectedLaneKey);
  }, [restaurant.id, selectedLaneKey, lanePrefsHydrated]);

  useEffect(() => {
    setNowMs(Date.now());
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

  const partyMemberIds = useMemo(
    () => tablePartyMemberTableIds(partyMembers),
    [partyMembers],
  );

  const checkoutPinnedCards = useMemo(() => {
    const pendingTables = tables.filter(
      (table) =>
        !partyMemberIds.has(table.id.toLowerCase()) &&
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
  }, [
    tables,
    summaryByTableId,
    checkoutRequestedTableIds,
    effectiveSessionMetaByTableId,
    partyMemberIds,
  ]);

  const checkoutInPartyCount = useMemo(
    () =>
      tables.filter(
        (table) =>
          partyMemberIds.has(table.id.toLowerCase()) &&
          isWaiterTableInCheckout(
            table.id,
            effectiveSessionMetaByTableId,
            checkoutRequestedTableIds,
          ),
      ).length,
    [
      tables,
      partyMemberIds,
      effectiveSessionMetaByTableId,
      checkoutRequestedTableIds,
    ],
  );

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
      supportsBuffetOpenTable,
      detailHref,
    });

    return (
      <WaiterBoardTableCard
        key={pinned ? `pinned-${card.tableId}` : card.tableId}
        card={card}
        boardState={boardState}
        action={action}
        session={effectiveSessionMetaByTableId[card.tableId]}
        checkoutRequestedAt={checkoutRequestedAtByTableId[card.tableId] ?? null}
        nowMs={nowMs}
        lang={lang}
        pinned={pinned}
        onOpenTable={() =>
          setOpenTableTarget({ tableId: card.tableId, displayName: card.displayName })
        }
        onOpenCheckout={() => setCheckoutTarget({ tableId: card.tableId })}
        onDisabledClick={() => showToast(t.buffetNotConfigured, 'info')}
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
      const withoutParty = tableIds.filter((id) => !partyMemberIds.has(id.toLowerCase()));
      const byStatus = filterWaiterBoardTableIds(
        withoutParty,
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
      partyMemberIds,
      tableSearchTrimmed,
    ],
  );

  const visibleFloorSections = useMemo(() => {
    return boardSections
      .map((section) => ({
        section,
        visibleIds: visibleBoardTableIds(section.tableIds),
      }))
      .filter((row) => row.visibleIds.length > 0);
  }, [boardSections, visibleBoardTableIds]);

  const visiblePartyLanes = useMemo(
    () =>
      buildVisibleWaiterBoardPartyLanes({
        parties,
        partyMembers,
        tables,
        summaryByTableId,
        boardFilter,
        boardStateContext,
        checkoutRequestedTableIds,
        sessionMetaByTableId: effectiveSessionMetaByTableId,
        tableSearchTrimmed,
        tableMatchesSearch: tableMatchesWaiterBoardSearch,
      }),
    [
      parties,
      partyMembers,
      tables,
      summaryByTableId,
      boardFilter,
      boardStateContext,
      checkoutRequestedTableIds,
      effectiveSessionMetaByTableId,
      tableSearchTrimmed,
    ],
  );

  const floorLaneKeys = useMemo(
    () => visibleFloorSections.map((row) => floorLaneKey(row.section.id)),
    [visibleFloorSections],
  );
  const partyLaneKeys = useMemo(
    () => visiblePartyLanes.map((row) => partyLaneKey(row.party.id)),
    [visiblePartyLanes],
  );

  const resolvedLaneKey = useMemo(
    () => resolveWaiterBoardSelectedLaneKey(selectedLaneKey, floorLaneKeys, partyLaneKeys),
    [selectedLaneKey, floorLaneKeys, partyLaneKeys],
  );

  useEffect(() => {
    if (!lanePrefsHydrated) return;
    if (resolvedLaneKey !== selectedLaneKey) {
      setSelectedLaneKey(resolvedLaneKey);
    }
  }, [lanePrefsHydrated, resolvedLaneKey, selectedLaneKey]);

  const selectLane = useCallback((key: WaiterBoardLaneKey) => {
    setSelectedLaneKey(key);
  }, []);

  const handlePartyCreated = useCallback((partyId: string) => {
    setSelectedLaneKey(partyLaneKey(partyId));
  }, []);

  const selectedFloorSection = useMemo(() => {
    const parsed = resolvedLaneKey ? parseWaiterBoardLaneKey(resolvedLaneKey) : null;
    if (!parsed || parsed.kind !== 'floor') return null;
    return visibleFloorSections.find((row) => row.section.id === parsed.id) ?? null;
  }, [resolvedLaneKey, visibleFloorSections]);

  const selectedPartyId = useMemo(() => {
    const parsed = resolvedLaneKey ? parseWaiterBoardLaneKey(resolvedLaneKey) : null;
    return parsed?.kind === 'party' ? parsed.id : null;
  }, [resolvedLaneKey]);

  const showCreatePartyControl = boardFilter === 'all' && !tableSearchTrimmed;
  const showLaneChrome =
    visibleFloorSections.length > 0 ||
    visiblePartyLanes.length > 0 ||
    showCreatePartyControl;

  const hasVisibleBoardContent = useMemo(() => {
    if (showCheckoutPinned) return true;
    if (visiblePartyLanes.length > 0) return true;
    return visibleFloorSections.length > 0;
  }, [showCheckoutPinned, visiblePartyLanes.length, visibleFloorSections.length]);

  const openTableSheetTable = useMemo(() => {
    if (!openTableTarget) return null;
    return tables.find((row) => tableIdsEqual(row.id, openTableTarget.tableId)) ?? null;
  }, [openTableTarget, tables]);

  return (
    <div className={isDemo ? 'min-h-screen bg-brand-bg p-4' : ''}>
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
          <h1 className={waiterBoardType.pageTitle}>{t.boardTitle}</h1>
        ) : null}

        <div className="flex flex-wrap gap-2" role="group" aria-label={t.boardTitle}>
          {BOARD_KPI_ITEMS.map((item) => (
            <BoardKpiCard
              key={item.filter}
              active={boardFilter === item.filter}
              count={boardStats[item.countKey]}
              label={t[item.labelKey]}
              hint={item.hintKey ? t[item.hintKey] : undefined}
              filter={item.filter}
              onClick={() => {
                setBoardFilter(item.filter);
                void refresh();
              }}
            />
          ))}
        </div>

        <div className="mt-3">
          <Input
            type="text"
            role="searchbox"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder={t.searchTablesPlaceholder}
            aria-label={t.searchTables}
            clearable
            clearLabel={t.clearSearch}
            className="px-3 py-2 focus:ring-brand-gold/40 placeholder:text-brand-text-muted"
          />
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
            {checkoutInPartyCount > 0 ? (
              <p className="mt-1 text-xs text-amber-900/80">
                {t.checkoutPinnedAlsoInPartyHint.replace(
                  '{n}',
                  String(checkoutInPartyCount),
                )}
              </p>
            ) : null}
          </div>
          <div className={WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS}>
            {visibleCheckoutPinnedCards.map((card) => renderTableCard(card, true))}
          </div>
        </section>
      ) : checkoutInPartyCount > 0 && boardFilter === 'all' && !tableSearchTrimmed ? (
        <p className="mb-4 text-xs text-amber-900/80">
          {t.checkoutPinnedAlsoInPartyHint.replace('{n}', String(checkoutInPartyCount))}
        </p>
      ) : null}

      {showLaneChrome ? (
        <div className="mb-4">
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            role="tablist"
            aria-label={t.boardTitle}
          >
            {visibleFloorSections.map(({ section, visibleIds }) => {
              const key = floorLaneKey(section.id);
              return (
                <BoardLaneTab
                  key={key}
                  active={resolvedLaneKey === key}
                  label={section.title}
                  countLabel={sectionTableCountLabel(visibleIds.length)}
                  onClick={() => selectLane(key)}
                />
              );
            })}
            {visiblePartyLanes.map(({ party, memberCount }) => {
              const key = partyLaneKey(party.id);
              return (
                <BoardLaneTab
                  key={key}
                  active={resolvedLaneKey === key}
                  label={party.name}
                  countLabel={t.partySectionCount.replace('{n}', String(memberCount))}
                  onClick={() => selectLane(key)}
                />
              );
            })}
            {showCreatePartyControl ? (
              <button
                type="button"
                disabled={partyBusy || isDemo}
                onClick={() => void partyActionsRef.current?.createParty()}
                className={`${WAITER_BOARD_LANE_CHROME.base} ${WAITER_BOARD_LANE_CHROME.idle} disabled:opacity-50`}
              >
                <span className={waiterBoardType.laneLabel}>
                  {partyBusy ? t.partyCreating : t.partyCreate}
                </span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <WaiterBoardPartySections
        ref={partyActionsRef}
        restaurantSlug={restaurant.slug}
        isDemo={isDemo}
        t={t}
        parties={parties}
        partyMembers={partyMembers}
        tables={tables}
        summaryByTableId={summaryByTableId}
        boardFilter={boardFilter}
        boardStateContext={boardStateContext}
        checkoutRequestedTableIds={checkoutRequestedTableIds}
        sessionMetaByTableId={effectiveSessionMetaByTableId}
        tableSearchTrimmed={tableSearchTrimmed}
        tableMatchesSearch={tableMatchesWaiterBoardSearch}
        selectedPartyId={selectedPartyId}
        onPartyCreated={handlePartyCreated}
        onBusyChange={setPartyBusy}
        onPartyStateChange={applyPartyState}
        onSessionRelocationPatch={applySessionRelocationPatch}
        onRefreshBoard={async (tableIds) => {
          if (refreshBoardAfterStaffMutation) {
            await refreshBoardAfterStaffMutation(tableIds);
            return;
          }
          await refresh();
        }}
        renderTableCard={renderTableCard}
      />

      {selectedFloorSection ? (
        <section aria-label={selectedFloorSection.section.title}>
          <div className={WAITER_BOARD_TABLES_GRID_CLASS}>
            {renderSectionCards(selectedFloorSection.section.tableIds)}
          </div>
        </section>
      ) : null}

      <WaiterBoardOpenTableSheet
        open={openTableTarget != null}
        onClose={() => setOpenTableTarget(null)}
        onOpenTableSuccess={handleOpenTableSuccess}
        onStaleBoard={handleOpenTableStaleBoard}
        restaurant={restaurant}
        tableId={openTableTarget?.tableId ?? ''}
        displayName={openTableTarget?.displayName ?? ''}
        table={openTableSheetTable}
        openTableDefaults={openTableDefaults}
        lang={lang}
      />

      {embeddedInDashboard ? (
        <WaiterBoardCheckoutSheet
          open={checkoutTarget != null}
          onClose={() => setCheckoutTarget(null)}
          restaurantId={restaurant.id}
          restaurantSlug={restaurant.slug}
          tableId={checkoutTarget?.tableId ?? ''}
        />
      ) : null}
    </div>
  );
}

export function WaiterDisplay(props: Props) {
  return <WaiterBoardInner {...props} />;
}
