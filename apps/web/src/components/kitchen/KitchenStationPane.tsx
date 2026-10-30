'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  LeadingActions,
  SwipeAction,
  SwipeableListItem,
  Type,
} from 'react-swipeable-list';
import 'react-swipeable-list/dist/styles.css';
import type { OrderItemStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { KitchenDishThumbButton } from '@/components/kitchen/KitchenDishThumbButton';
import { KitchenPrepTray } from '@/components/kitchen/KitchenPrepTray';
import {
  aggregateLinesByDish,
  buildPrepTrayCards,
  groupBottomRailByStatus,
  groupLinesByTable,
  groupSelectionFrac,
  isKitchenWaitHot,
  lineNoteKey,
  lineSelectionKey,
  lineWaitMinutes,
  partitionStationLines,
  removeTrayKeys,
  setTrayKeysSelected,
  sumLineQty,
  summarizeKitchenGroup,
  toggleGroupPrepSelection,
  toggleTrayChip,
  type GroupSelectionFrac,
  type KitchenBoardLine,
  type KitchenGroupSummary,
  type PrepTrayCard,
  type PrepTrayState,
} from '@/components/kitchen/kitchen-board-lines';
import { KITCHEN_SCREEN_TEXT } from '@/components/kitchen/kitchen-screen-labels';
import type { KitchenPrepSource } from '@/components/kitchen/use-kitchen-prep-trays';
import {
  resolveKitchenBoardDishThumb,
  type KitchenBoardMenuCatalogById,
} from '@/lib/kitchen-board-menu-catalog';
import type { UILanguage } from '@/lib/i18n';

/**
 * Sole kitchen workbench row swipe: `react-swipeable-list` Type.ANDROID.
 * Config lives only on `SwipeableListItem` (no DIY pointer machine; no parallel gesture helper).
 * Threshold / maxSwipe are fractions of row width — keep threshold low for wide panes;
 * maxSwipe must still fit the sole「备餐」cue on a phone-wide row (~≥5.5rem reveal).
 */
const KITCHEN_SWIPE_THRESHOLD = 0.12;
const KITCHEN_SWIPE_MAX = 0.28;
const KITCHEN_SWIPE_START_PX = 12;
const KITCHEN_SCROLL_START_PX = 12;

/** Sole right-swipe prep cue chrome — fills the revealed strip; gold + on-gold (never brand-ink). */
const KITCHEN_SWIPE_PREP_CUE_CLASS =
  'flex h-full w-full items-center justify-center bg-brand-gold px-3 text-xl font-semibold text-brand-on-gold';

type PaneView = 'table' | 'dish';

/** One UI shape for every selectable kitchen row (workbench + ready rail). */
type LineLayout = 'workbench-table' | 'workbench-dish-l2' | 'ready';

type Props = {
  stationName: string;
  /** This station's board lines (`collectStationBoardLines`, computed once by the screen). */
  lines: KitchenBoardLine[];
  nowMs: number;
  lang: UILanguage;
  /** Sole board catalog map for thumbs (may be empty; order fallback then). */
  menuCatalogById: KitchenBoardMenuCatalogById;
  maximized: boolean;
  canMaximize: boolean;
  onToggleMaximize: () => void;
  /** This station's slice of the screen's sole prep tray state (`useKitchenPrepTrays`). */
  tray: PrepTrayState;
  onTrayChange: (fn: (prev: PrepTrayState) => PrepTrayState) => void;
  /** False when the screen shows one shared prep tray instead (list-only pane). */
  showTray: boolean;
  /** Screen-wide prep in-flight keys (row spinner + this station's prep lock). */
  prepInFlightKeys: ReadonlySet<string>;
  onRunPrep: (lines: KitchenBoardLine[], source: KitchenPrepSource) => Promise<unknown>;
  bottomRailOpen: boolean;
  onBottomRailOpenChange: (open: boolean) => void;
  onOpenDishDetail: (menuItemId: string, orderItem: KitchenBoardLine['item']) => void;
  /** Returns true when print API/demo succeeded. */
  onPrint: (selections: Array<{ order_id: string; item_index: number }>) => Promise<boolean>;
  printBusy: boolean;
};

/** Sole workbench group select-all control (tri-state). Name/expand stay separate. */
function KitchenGroupSelectControl({
  state,
  disabled,
  title,
  onToggle,
}: {
  state: GroupSelectionFrac['state'];
  disabled: boolean;
  title: string;
  onToggle: () => void;
}) {
  const checked = state === 'all';
  const partial = state === 'partial';
  return (
    <button
      type="button"
      data-kitchen-group-select=""
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-checked={checked ? 'true' : partial ? 'mixed' : 'false'}
      role="checkbox"
      className="grid h-9 w-9 shrink-0 place-items-center disabled:opacity-40"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <span
        aria-hidden
        className={`relative h-[22px] w-[22px] rounded-md border-2 ${
          checked
            ? 'border-brand-gold bg-brand-gold'
            : partial
              ? 'border-brand-gold bg-brand-card'
              : 'border-brand-border bg-brand-card'
        }`}
      >
        {partial ? (
          <span className="absolute left-1 right-1 top-1/2 h-[2.5px] -translate-y-1/2 rounded-sm bg-brand-gold" />
        ) : null}
      </span>
    </button>
  );
}

/** Sole workbench row indent class — geometry lives in `globals.css` (container query). */
const KITCHEN_GROUP_ROW_INDENT_CLASS = 'mesa-kitchen-group-row pr-2';

/**
 * Sole workbench group header (by-table + by-dish): chevron · select · optional dish thumb ·
 * title + one-line summary (`N 道|桌 · 共 N 份 · 最久 N 分`) · right-hand «已选 n/m».
 * The thumb belongs to the dish, so only the by-dish header mounts it; by-table rows carry theirs.
 */
function KitchenGroupHeader({
  open,
  frac,
  selectDisabled,
  title,
  countLabel,
  summary,
  thumb,
  t,
  onToggleOpen,
  onToggleSelect,
}: {
  open: boolean;
  frac: GroupSelectionFrac;
  selectDisabled: boolean;
  title: string;
  /** Distinct-count part of the summary (`dishCount` for tables, `tableCount` for dishes). */
  countLabel: string;
  summary: KitchenGroupSummary;
  thumb?: ReactNode;
  t: Labels;
  onToggleOpen: () => void;
  onToggleSelect: () => void;
}) {
  const hot = isKitchenWaitHot(summary.longestWaitMin);
  return (
    <div
      data-kitchen-group-header=""
      className={`sticky top-0 z-[1] flex w-full items-center gap-2 border-b border-brand-border/60 px-2 py-2 backdrop-blur-sm ${groupHeaderShellClass(frac.state)}`}
    >
      {/* Chevron + select: gap-3 + 36px hit boxes so kitchen touch does not mis-fire. */}
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center text-brand-text-muted"
          onClick={onToggleOpen}
        >
          <svg
            viewBox="0 0 20 20"
            className={`h-5 w-5 transition-transform ${open ? '' : '-rotate-90'}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 8l5 5 5-5" />
          </svg>
        </button>
        <KitchenGroupSelectControl
          state={frac.state}
          disabled={selectDisabled}
          title={frac.state === 'all' ? t.deselectAll : t.selectAll}
          onToggle={onToggleSelect}
        />
      </div>
      {thumb}
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col items-start text-left"
        aria-expanded={open}
        aria-label={`${title} · ${open ? t.collapseGroup : t.expandGroup}`}
        onClick={onToggleOpen}
      >
        <span className="w-full truncate text-2xl font-medium leading-tight text-brand-text">
          {title}
        </span>
        <span className="mesa-kitchen-group-summary w-full text-base leading-tight text-brand-text-muted">
          <span className="mesa-kitchen-group-count">{countLabel} · </span>
          {t.portionBadge.replace('{n}', String(summary.qty))} ·{' '}
          <span
            className={hot ? 'font-semibold text-red-700' : undefined}
            suppressHydrationWarning
          >
            {t.longestWait.replace('{n}', String(summary.longestWaitMin))}
          </span>
        </span>
      </button>
      <span
        data-kitchen-group-frac=""
        className="shrink-0 text-base tabular-nums text-brand-text-muted"
      >
        {t.selectedOf
          .replace('{n}', String(frac.selected))
          .replace('{m}', String(frac.total))}
      </span>
    </div>
  );
}

function groupHeaderShellClass(state: GroupSelectionFrac['state']): string {
  if (state === 'all') {
    return 'border-l-4 border-l-brand-gold bg-brand-gold/20';
  }
  if (state === 'partial') {
    return 'border-l-4 border-l-brand-gold bg-brand-gold/10';
  }
  return 'border-l-4 border-l-transparent bg-brand-bg/95';
}

type Labels = (typeof KITCHEN_SCREEN_TEXT)[UILanguage];

/** Sole table title («90 桌») for group headers, by-dish rows and the ready rail. */
function formatKitchenTableTitle(t: Labels, tableDisplay: string): string {
  return t.tableTitle.replace('{name}', tableDisplay);
}

/** Workbench / ready rails: sole vertical scroll ports (list owns Y; row swipe owns X via library). */
const VERTICAL_ONLY_SCROLL =
  'min-h-0 overflow-y-auto overflow-x-hidden overscroll-x-none';

/** Sole chrome size for station footer actions (ready-rail toggle + prep/print). */
const STATION_FOOTER_BTN = 'min-h-9 px-4 text-lg';

/**
 * Sole expanded bottom-rail panel chrome (recessive cool slate vs workbench paper).
 * Do not reuse workbench `bg-brand-card` row fill here — that is what made zones look continuous.
 */
const KITCHEN_READY_RAIL_PANEL_CLASS = `max-h-64 border-t-[3px] border-slate-400 bg-slate-200/90 ${VERTICAL_ONLY_SCROLL}`;
const KITCHEN_READY_RAIL_HEADER_CLASS =
  'sticky top-0 z-[1] flex items-center gap-2 border-b border-slate-400/70 bg-slate-300/95 px-3 py-2 text-lg font-semibold text-slate-700 backdrop-blur-sm';
const KITCHEN_READY_RAIL_SUBHEAD_CLASS =
  'px-3 pb-1 pt-2 text-sm font-semibold tracking-wide text-slate-500';

function statusLabel(status: OrderItemStatus, t: Labels): string {
  if (status === 'ready') return t.statusReady;
  if (status === 'cooking') return t.statusCooking;
  if (status === 'done') return t.statusDone;
  return t.statusPending;
}

function statusTone(status: OrderItemStatus): string {
  if (status === 'ready') return 'text-emerald-800 bg-emerald-100';
  if (status === 'cooking') return 'text-amber-900 bg-amber-100';
  return 'text-red-800 bg-red-100';
}

/** Sole bottom-rail row left accent (cooking amber / ready emerald) — pairs with status chip. */
function readyRailAccentClass(status: OrderItemStatus): string {
  if (status === 'ready') return 'shadow-[inset_3px_0_0_#059669]';
  return 'shadow-[inset_3px_0_0_#d97706]';
}

/** Sole row surface fill: workbench paper vs recessive rail slate. */
function kitchenRowSurfaceClass(input: {
  layout: LineLayout;
  checked: boolean;
  status: OrderItemStatus;
}): string {
  if (input.layout === 'ready') {
    const accent = readyRailAccentClass(input.status);
    return input.checked
      ? `bg-slate-100 ring-1 ring-inset ring-brand-gold/50 ${accent}`
      : `bg-slate-100 ${accent}`;
  }
  return input.checked
    ? 'bg-brand-bg ring-1 ring-inset ring-brand-gold/50'
    : 'bg-brand-card';
}

/**
 * Sole kitchen board row UI — one order line (`orderId:itemIndex`), never merged.
 * Whole-row tap toggles select; right-swipe past threshold preps via react-swipeable-list
 * Type.ANDROID (row stays; library snap-back; brief gold「备餐」cue while dragging).
 */
function KitchenBoardLineRow({
  line,
  checked,
  layout,
  nowMs,
  t,
  prepBusy,
  printBusy,
  prepInFlight,
  thumbImageUrl,
  thumbEmoji,
  onOpenDetail,
  onToggle,
  onSwipePrep,
}: {
  line: KitchenBoardLine;
  checked: boolean;
  layout: LineLayout;
  nowMs: number;
  t: Labels;
  prepBusy: boolean;
  printBusy: boolean;
  /** Sole row-level prep in-flight (swipe or footer multi-prep). */
  prepInFlight: boolean;
  thumbImageUrl: string | null;
  thumbEmoji: string;
  onOpenDetail: () => void;
  onToggle: () => void;
  onSwipePrep: () => void;
}) {
  const note = lineNoteKey(line.item);
  const waitMin = lineWaitMinutes(line.orderedAtMs, nowMs);
  const rowInteractive = line.prepEligible || line.printEligible;
  const stationLocked = prepBusy || printBusy || prepInFlight;
  const canSwipePrep = line.prepEligible && !stationLocked;

  const noteEl = note ? (
    <span className="ml-2 text-xl font-normal text-amber-800/90">· {note}</span>
  ) : null;

  let title: ReactNode;
  if (layout === 'workbench-table') {
    title = (
      <span className="mesa-kitchen-row-title min-w-0 flex-1 truncate text-2xl font-medium leading-tight text-brand-text">
        {line.displayName}
        {noteEl}
      </span>
    );
  } else if (layout === 'ready') {
    title = (
      <span className="mesa-kitchen-row-title min-w-0 flex-1 truncate text-2xl font-medium leading-tight text-slate-700">
        {line.displayName}
        {noteEl}
        <span className="ml-2 text-xl font-normal text-slate-500">
          {' '}
          · {formatKitchenTableTitle(t, line.tableDisplay)}
        </span>
      </span>
    );
  } else {
    // By-dish L2: table display is the row title (dish name already on L1).
    title = (
      <span className="mesa-kitchen-row-title min-w-0 flex-1 truncate text-2xl font-medium leading-tight text-brand-text">
        {formatKitchenTableTitle(t, line.tableDisplay)}
        {noteEl}
      </span>
    );
  }

  const leadingActions = canSwipePrep ? (
    <LeadingActions>
      <SwipeAction destructive={false} onClick={onSwipePrep}>
        <span className={KITCHEN_SWIPE_PREP_CUE_CLASS}>{t.prep}</span>
      </SwipeAction>
    </LeadingActions>
  ) : undefined;

  return (
    <SwipeableListItem
      listType={Type.ANDROID}
      blockSwipe={!canSwipePrep}
      leadingActions={leadingActions}
      threshold={KITCHEN_SWIPE_THRESHOLD}
      maxSwipe={KITCHEN_SWIPE_MAX}
      swipeStartThreshold={KITCHEN_SWIPE_START_PX}
      scrollStartThreshold={KITCHEN_SCROLL_START_PX}
      onClick={rowInteractive && !stationLocked ? onToggle : undefined}
      className="border-b border-brand-border/50"
    >
      <div
        className={`flex min-w-0 w-full max-w-full items-center gap-3 py-2.5 ${
          layout === 'ready' ? 'px-2' : KITCHEN_GROUP_ROW_INDENT_CLASS
        } ${kitchenRowSurfaceClass(
          { layout, checked, status: line.effectiveStatus },
        )} ${rowInteractive ? '' : 'opacity-55'}`}
        data-kitchen-prep-in-flight={prepInFlight ? '' : undefined}
        aria-busy={prepInFlight || undefined}
      >
        {/* Same 36px column as header select so the boxes share one vertical line. */}
        <span className="grid h-9 w-9 shrink-0 place-items-center">
          <input
            type="checkbox"
            className="h-6 w-6"
            checked={checked}
            disabled={!rowInteractive || stationLocked}
            onChange={onToggle}
            onClick={(e) => e.stopPropagation()}
            aria-label={line.displayName}
          />
        </span>
        {layout === 'workbench-dish-l2' ? null : (
          <KitchenDishThumbButton
            imageUrl={thumbImageUrl}
            emoji={thumbEmoji}
            ariaLabel={t.dishThumbOpenDetail}
            onOpen={onOpenDetail}
          />
        )}
        <div className="mesa-kitchen-row-main">
          {title}
          <span
            className={`shrink-0 text-xl font-semibold tabular-nums ${
              layout === 'ready' ? 'text-amber-900/70' : 'text-brand-gold'
            }`}
          >
            × {Number(line.item.qty) || 0}
          </span>
          <span
            className={`shrink-0 text-lg tabular-nums ${
              layout === 'ready'
                ? 'text-slate-500'
                : isKitchenWaitHot(waitMin)
                  ? 'font-semibold text-red-700'
                  : 'text-brand-text-muted'
            }`}
            suppressHydrationWarning
          >
            {t.waitMinutes.replace('{n}', String(waitMin))}
          </span>
          {prepInFlight ? (
            <span
              className="inline-flex shrink-0 items-center gap-2 text-lg font-medium text-brand-gold"
              aria-label={t.prepBusy}
            >
              <Spinner className="h-5 w-5" />
              <span>{t.prepBusy}</span>
            </span>
          ) : layout === 'ready' ? (
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-lg font-medium ${statusTone(line.effectiveStatus)}`}
            >
              {statusLabel(line.effectiveStatus, t)}
            </span>
          ) : null}
        </div>
      </div>
    </SwipeableListItem>
  );
}

export function KitchenStationPane({
  stationName,
  lines: allLines,
  nowMs,
  lang,
  menuCatalogById,
  maximized,
  canMaximize,
  onToggleMaximize,
  tray,
  onTrayChange,
  showTray,
  prepInFlightKeys,
  onRunPrep,
  bottomRailOpen,
  onBottomRailOpenChange,
  onOpenDishDetail,
  onPrint,
  printBusy,
}: Props) {
  const t = KITCHEN_SCREEN_TEXT[lang];
  const [view, setView] = useState<PaneView>('table');
  const { selected, skipped } = tray;
  /** Sole by-dish L1 expand key (`menuItemId`); null = all dish groups collapsed. */
  const [expandedDish, setExpandedDish] = useState<string | null>(null);
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(() => new Set());

  const setSelected = (fn: (prev: Set<string>) => Set<string>) =>
    onTrayChange((prev) => ({ selected: fn(prev.selected), skipped: prev.skipped }));
  const setSkipped = (fn: (prev: Set<string>) => Set<string>) =>
    onTrayChange((prev) => ({ selected: prev.selected, skipped: fn(prev.skipped) }));

  const { workbench, bottomRail } = useMemo(() => partitionStationLines(allLines), [allLines]);
  const { cooking: railCooking, ready: railReady } = useMemo(
    () => groupBottomRailByStatus(bottomRail),
    [bottomRail],
  );
  const byTable = useMemo(() => groupLinesByTable(workbench), [workbench]);
  const byDish = useMemo(() => aggregateLinesByDish(workbench), [workbench]);
  const bottomRailQty = useMemo(() => sumLineQty(bottomRail), [bottomRail]);

  const selectedPrintCount = useMemo(
    () => allLines.filter((l) => selected.has(l.key) && l.printEligible).length,
    [allLines, selected],
  );
  /** Station prep lock: any of this station's lines in the board's sole prep in-flight set. */
  const prepLocked = useMemo(
    () => allLines.some((l) => prepInFlightKeys.has(l.key)),
    [allLines, prepInFlightKeys],
  );

  /** Left-list edits own the row outright: it is either selected or out of the tray (never skipped). */
  const dropSkipped = (keys: readonly string[]) => {
    setSkipped((prev) => {
      if (!keys.some((k) => prev.has(k))) return prev;
      const next = new Set(prev);
      for (const k of keys) next.delete(k);
      return next;
    });
  };

  const toggleLine = (line: KitchenBoardLine) => {
    if (!line.prepEligible && !line.printEligible) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(line.key)) next.delete(line.key);
      else next.add(line.key);
      return next;
    });
    dropSkipped([line.key]);
  };

  const toggleGroupSelect = (lines: KitchenBoardLine[]) => {
    setSelected((prev) => toggleGroupPrepSelection(lines, prev));
    dropSkipped(lines.map((l) => l.key));
  };

  const trayCards = useMemo(
    () => buildPrepTrayCards(workbench, { selected, skipped }, nowMs),
    [workbench, selected, skipped, nowMs],
  );

  const toggleTableCollapsed = (tableId: string) => {
    setCollapsedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  };

  /** Collapse clears print-only selection so workbench reopen does not keep a stale print set. */
  const toggleBottomRail = () => {
    if (bottomRailOpen) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const l of allLines) {
          if (l.printEligible && next.has(l.key)) next.delete(l.key);
        }
        return next;
      });
    }
    onBottomRailOpenChange(!bottomRailOpen);
  };

  const handlePrep = () => {
    const prepLines = allLines.filter((l) => selected.has(l.key) && l.prepEligible);
    void onRunPrep(prepLines, 'tray');
  };

  const handlePrint = async () => {
    const selections = allLines
      .filter((l) => selected.has(l.key) && l.printEligible)
      .map((l) => ({ order_id: l.orderId, item_index: l.itemIndex }));
    if (selections.length === 0) return;
    const ok = await onPrint(selections);
    if (ok) {
      showToast(t.printSuccess, 'success');
      setSelected((prev) => {
        const next = new Set(prev);
        for (const l of allLines) {
          if (l.printEligible && next.has(l.key)) next.delete(l.key);
        }
        return next;
      });
    }
  };

  const handleSwipePrep = (line: KitchenBoardLine) => {
    if (!line.prepEligible || prepLocked || printBusy) return;
    void onRunPrep([line], 'swipe');
  };

  const thumbForLine = useCallback(
    (line: KitchenBoardLine) =>
      resolveKitchenBoardDishThumb({
        menuItemId: line.menuItemId,
        catalogById: menuCatalogById,
        orderItem: line.item,
      }),
    [menuCatalogById],
  );

  const renderLine = (line: KitchenBoardLine, layout: LineLayout) => {
    const thumb = thumbForLine(line);
    return (
      <KitchenBoardLineRow
        key={line.key}
        line={line}
        checked={selected.has(line.key)}
        layout={layout}
        nowMs={nowMs}
        t={t}
        prepBusy={prepLocked}
        printBusy={printBusy}
        prepInFlight={prepInFlightKeys.has(line.key)}
        thumbImageUrl={thumb.imageUrl}
        thumbEmoji={thumb.emoji}
        onOpenDetail={() => onOpenDishDetail(line.menuItemId, line.item)}
        onToggle={() => toggleLine(line)}
        onSwipePrep={() => handleSwipePrep(line)}
      />
    );
  };

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col bg-brand-card ${
        maximized ? 'h-full border-0' : 'rounded-xl border border-brand-border'
      }`}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-brand-border/70 px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate font-heading text-xl leading-tight text-brand-gold">
          {stationName}
        </h2>
        {canMaximize ? (
          <button
            type="button"
            className="px-3 py-1.5 text-lg font-medium text-brand-text-muted hover:text-brand-text"
            onClick={onToggleMaximize}
          >
            {maximized ? t.restore : t.maximize}
          </button>
        ) : null}
      </header>

      <div className="mesa-kitchen-pane-host">
      <div className="mesa-kitchen-pane-split" data-tray-shared={showTray ? undefined : ''}>
      <div className="mesa-kitchen-pane-list flex flex-col">
        <div className="shrink-0 border-b border-brand-border/70 px-3 py-2">
          <div className="flex w-fit overflow-hidden rounded-lg border border-brand-border text-lg">
            <button
              type="button"
              className={`px-3 py-1.5 ${view === 'table' ? 'bg-brand-gold/20 font-medium text-brand-text' : 'text-brand-text-muted'}`}
              onClick={() => setView('table')}
            >
              {t.viewByTable}
            </button>
            <button
              type="button"
              className={`border-l border-brand-border px-3 py-1.5 ${view === 'dish' ? 'bg-brand-gold/20 font-medium text-brand-text' : 'text-brand-text-muted'}`}
              onClick={() => setView('dish')}
            >
              {t.viewByDish}
            </button>
          </div>
        </div>
        <div className={`min-h-0 flex-1 ${VERTICAL_ONLY_SCROLL}`}>
        {workbench.length === 0 ? (
          <p className="py-16 text-center text-2xl text-brand-text-muted">{t.noLines}</p>
        ) : view === 'table' ? (
          byTable.map((group) => {
            const open = !collapsedTables.has(group.tableId);
            const frac = groupSelectionFrac(group.lines, selected);
            const summary = summarizeKitchenGroup(group.lines, nowMs);
            return (
              <div key={group.tableId}>
                <KitchenGroupHeader
                  open={open}
                  frac={frac}
                  selectDisabled={frac.total === 0 || prepLocked || printBusy}
                  title={formatKitchenTableTitle(t, group.tableDisplay)}
                  countLabel={t.dishCount.replace('{n}', String(summary.dishCount))}
                  summary={summary}
                  t={t}
                  onToggleOpen={() => toggleTableCollapsed(group.tableId)}
                  onToggleSelect={() => toggleGroupSelect(group.lines)}
                />
                {open ? group.lines.map((line) => renderLine(line, 'workbench-table')) : null}
              </div>
            );
          })
        ) : (
          byDish.map((dish) => {
            const open = expandedDish === dish.menuItemId;
            const seedLine = dish.lines[0];
            const frac = groupSelectionFrac(dish.lines, selected);
            const summary = summarizeKitchenGroup(dish.lines, nowMs);
            const thumb = thumbForLine(seedLine);
            return (
              <div key={dish.menuItemId}>
                <KitchenGroupHeader
                  open={open}
                  frac={frac}
                  selectDisabled={frac.total === 0 || prepLocked || printBusy}
                  title={dish.name}
                  countLabel={t.tableCount.replace('{n}', String(summary.tableCount))}
                  summary={summary}
                  thumb={
                    <KitchenDishThumbButton
                      imageUrl={thumb.imageUrl}
                      emoji={thumb.emoji}
                      ariaLabel={t.dishThumbOpenDetail}
                      onOpen={() => onOpenDishDetail(dish.menuItemId, seedLine.item)}
                    />
                  }
                  t={t}
                  onToggleOpen={() =>
                    setExpandedDish((prev) => (prev === dish.menuItemId ? null : dish.menuItemId))
                  }
                  onToggleSelect={() => toggleGroupSelect(dish.lines)}
                />
                {open ? dish.lines.map((line) => renderLine(line, 'workbench-dish-l2')) : null}
              </div>
            );
          })
        )}
        </div>
      </div>
      {showTray ? (
        <div
          className="mesa-kitchen-pane-tray min-h-0 flex-col overflow-hidden border-brand-border"
          data-empty={trayCards.length === 0 ? '' : undefined}
        >
          <KitchenPrepTray
            sections={[{ stationId: '', title: null, cards: trayCards }]}
            t={t}
            prepLocked={prepLocked}
            thumbFor={(card: PrepTrayCard) => thumbForLine(card.seedLine)}
            onOpenDetail={(card: PrepTrayCard) =>
              onOpenDishDetail(card.menuItemId, card.seedLine.item)
            }
            onToggleChip={(key) => onTrayChange((prev) => toggleTrayChip(key, prev))}
            onSetCard={(keys, on) => onTrayChange((prev) => setTrayKeysSelected(keys, on, prev))}
            onRemoveKeys={(keys) => onTrayChange((prev) => removeTrayKeys(keys, prev))}
            onPrep={handlePrep}
          />
        </div>
      ) : null}
      </div>
      </div>

      <footer className="flex shrink-0 flex-col border-t border-brand-border/70">
        {bottomRailOpen ? (
          <div
            className={KITCHEN_READY_RAIL_PANEL_CLASS}
            role="region"
            aria-label={t.readyRailZoneTitle}
          >
            {bottomRail.length === 0 ? (
              <p className="px-3 py-4 text-center text-xl text-slate-500">{t.readyRailEmpty}</p>
            ) : (
              <>
                <div className={KITCHEN_READY_RAIL_HEADER_CLASS}>
                  <span className="min-w-0 flex-1 truncate">{t.readyRailZoneTitle}</span>
                  <span className="shrink-0 text-base font-medium tabular-nums text-slate-500">
                    {t.portionBadge.replace('{n}', String(bottomRailQty))}
                  </span>
                </div>
                {railCooking.length > 0 ? (
                  <>
                    <div className={KITCHEN_READY_RAIL_SUBHEAD_CLASS}>{t.statusCooking}</div>
                    {railCooking.map((line) => renderLine(line, 'ready'))}
                  </>
                ) : null}
                {railReady.length > 0 ? (
                  <>
                    <div className={KITCHEN_READY_RAIL_SUBHEAD_CLASS}>{t.statusReady}</div>
                    {railReady.map((line) => renderLine(line, 'ready'))}
                  </>
                ) : null}
              </>
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={STATION_FOOTER_BTN}
            disabled={bottomRailQty === 0 && !bottomRailOpen}
            onClick={toggleBottomRail}
          >
            {bottomRailOpen
              ? t.readyRailHide
              : t.readyRailShow.replace('{n}', String(bottomRailQty))}
          </Button>
          {/* Footer owns reprint only; the sole prep button lives in the prep tray. */}
          {bottomRailOpen ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={STATION_FOOTER_BTN}
              disabled={selectedPrintCount === 0 || printBusy || prepLocked}
              loading={printBusy}
              title={t.selectPrintLines}
              onClick={() => void handlePrint()}
            >
              {printBusy ? t.printBusy : t.print}
            </Button>
          ) : null}
        </div>
      </footer>
    </section>
  );
}

/** Re-export for tests / callers that need the key helper. */
export { lineSelectionKey };
