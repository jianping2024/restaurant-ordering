'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  LeadingActions,
  SwipeAction,
  SwipeableListItem,
  Type,
} from 'react-swipeable-list';
import 'react-swipeable-list/dist/styles.css';
import type { Order, OrderItemStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { MenuItemListThumb } from '@/components/dashboard/MenuItemListThumb';
import { KitchenMenuItemDetailModal } from '@/components/kitchen/KitchenMenuItemDetailModal';
import {
  aggregateLinesByDish,
  collectStationBoardLines,
  groupBottomRailByStatus,
  groupLinesByTable,
  lineNoteKey,
  lineSelectionKey,
  lineWaitMinutes,
  partitionStationLines,
  sumLineQty,
  type KitchenBoardLine,
} from '@/components/kitchen/kitchen-board-lines';
import { KITCHEN_SCREEN_TEXT } from '@/components/kitchen/kitchen-screen-labels';
import {
  resolveKitchenBoardDishCatalogEntry,
  type KitchenBoardMenuCatalogById,
  type KitchenBoardMenuCatalogEntry,
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
  stationId: string;
  stationName: string;
  orders: Order[];
  readyAfterMinutes: number;
  nowMs: number;
  lang: UILanguage;
  /** Sole board catalog map for thumbs + detail (may be empty; order fallback then). */
  menuCatalogById: KitchenBoardMenuCatalogById;
  flavorHintsEnabled: boolean;
  maximized: boolean;
  canMaximize: boolean;
  onToggleMaximize: () => void;
  /** Returns true when prep API/demo succeeded. */
  onPrep: (selections: Array<{ order_id: string; item_index: number }>) => Promise<boolean>;
  prepBusy: boolean;
  /** Returns true when print API/demo succeeded. */
  onPrint: (selections: Array<{ order_id: string; item_index: number }>) => Promise<boolean>;
  printBusy: boolean;
};

/** Sole kitchen-board dish thumb control — opens read-only detail; never toggles row select. */
function KitchenDishThumbButton({
  imageUrl,
  emoji,
  ariaLabel,
  onOpen,
}: {
  imageUrl: string | null;
  emoji: string;
  ariaLabel: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      data-kitchen-dish-thumb=""
      className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerCancel={(e) => e.stopPropagation()}
    >
      <MenuItemListThumb item={{ image_url: imageUrl, emoji }} size={56} />
    </button>
  );
}

type Labels = (typeof KITCHEN_SCREEN_TEXT)[UILanguage];

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
  thumbImageUrl: string | null;
  thumbEmoji: string;
  onOpenDetail: () => void;
  onToggle: () => void;
  onSwipePrep: () => void;
}) {
  const note = lineNoteKey(line.item);
  const waitMin = lineWaitMinutes(line.orderedAtMs, nowMs);
  const rowInteractive = line.prepEligible || line.printEligible;
  const canSwipePrep = line.prepEligible && !prepBusy && !printBusy;

  const noteEl = note ? (
    <span className="ml-2 text-xl font-normal text-amber-800/90">· {note}</span>
  ) : null;

  let title: ReactNode;
  if (layout === 'workbench-table') {
    title = (
      <span className="min-w-0 flex-1 truncate text-2xl font-medium leading-tight text-brand-text">
        {line.displayName}
        {noteEl}
      </span>
    );
  } else if (layout === 'ready') {
    title = (
      <span className="min-w-0 flex-1 truncate text-2xl font-medium leading-tight text-slate-700">
        {line.displayName}
        {noteEl}
        <span className="ml-2 text-xl font-normal text-slate-500"> · {line.tableDisplay}</span>
      </span>
    );
  } else {
    title = (
      <span className="min-w-0 flex-1 truncate text-2xl font-medium leading-tight text-brand-text">
        {line.tableDisplay}
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
      onClick={rowInteractive && !prepBusy && !printBusy ? onToggle : undefined}
      className="border-b border-brand-border/50"
    >
      <div
        className={`flex min-w-0 w-full max-w-full items-center gap-3 px-2 py-2.5 ${kitchenRowSurfaceClass(
          { layout, checked, status: line.effectiveStatus },
        )} ${rowInteractive ? '' : 'opacity-55'}`}
      >
        <input
          type="checkbox"
          className="h-6 w-6 shrink-0"
          checked={checked}
          disabled={!rowInteractive || prepBusy || printBusy}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          aria-label={line.displayName}
        />
        <KitchenDishThumbButton
          imageUrl={thumbImageUrl}
          emoji={thumbEmoji}
          ariaLabel={t.dishThumbOpenDetail}
          onOpen={onOpenDetail}
        />
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
            layout === 'ready' ? 'text-slate-500' : 'text-brand-text-muted'
          }`}
          suppressHydrationWarning
        >
          {t.waitMinutes.replace('{n}', String(waitMin))}
        </span>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-lg font-medium ${statusTone(line.effectiveStatus)}`}
        >
          {statusLabel(line.effectiveStatus, t)}
        </span>
      </div>
    </SwipeableListItem>
  );
}

export function KitchenStationPane({
  stationId,
  stationName,
  orders,
  readyAfterMinutes,
  nowMs,
  lang,
  menuCatalogById,
  flavorHintsEnabled,
  maximized,
  canMaximize,
  onToggleMaximize,
  onPrep,
  prepBusy,
  onPrint,
  printBusy,
}: Props) {
  const t = KITCHEN_SCREEN_TEXT[lang];
  const [view, setView] = useState<PaneView>('table');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [expandedDish, setExpandedDish] = useState<string | null>(null);
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(() => new Set());
  const [bottomRailOpen, setBottomRailOpen] = useState(false);
  /** Frozen at open so Realtime board churn cannot empty the modal mid-view. */
  const [detailEntry, setDetailEntry] = useState<KitchenBoardMenuCatalogEntry | null>(null);

  const allLines = useMemo(
    () =>
      collectStationBoardLines({
        orders,
        printStationId: stationId,
        nowMs,
        readyAfterMinutes,
        lang,
      }),
    [orders, stationId, nowMs, readyAfterMinutes, lang],
  );

  const { workbench, bottomRail } = useMemo(() => partitionStationLines(allLines), [allLines]);
  const { cooking: railCooking, ready: railReady } = useMemo(
    () => groupBottomRailByStatus(bottomRail),
    [bottomRail],
  );
  const byTable = useMemo(() => groupLinesByTable(workbench), [workbench]);
  const byDish = useMemo(() => aggregateLinesByDish(workbench), [workbench]);
  const bottomRailQty = useMemo(() => sumLineQty(bottomRail), [bottomRail]);

  const selectedPrepCount = useMemo(
    () => allLines.filter((l) => selected.has(l.key) && l.prepEligible).length,
    [allLines, selected],
  );
  const selectedPrintCount = useMemo(
    () => allLines.filter((l) => selected.has(l.key) && l.printEligible).length,
    [allLines, selected],
  );

  const toggleLine = (line: KitchenBoardLine) => {
    if (!line.prepEligible && !line.printEligible) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(line.key)) next.delete(line.key);
      else next.add(line.key);
      return next;
    });
  };

  const selectAllForTable = (lines: KitchenBoardLine[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const selectable = lines.filter((l) => l.prepEligible);
      const allOn = selectable.length > 0 && selectable.every((l) => next.has(l.key));
      for (const l of selectable) {
        if (allOn) next.delete(l.key);
        else next.add(l.key);
      }
      return next;
    });
  };

  const tableAllSelected = (lines: KitchenBoardLine[]) => {
    const selectable = lines.filter((l) => l.prepEligible);
    return selectable.length > 0 && selectable.every((l) => selected.has(l.key));
  };

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
    setBottomRailOpen((open) => {
      if (open) {
        setSelected((prev) => {
          const next = new Set(prev);
          for (const l of allLines) {
            if (l.printEligible && next.has(l.key)) next.delete(l.key);
          }
          return next;
        });
      }
      return !open;
    });
  };

  const handlePrep = async () => {
    const selections = allLines
      .filter((l) => selected.has(l.key) && l.prepEligible)
      .map((l) => ({ order_id: l.orderId, item_index: l.itemIndex }));
    if (selections.length === 0) return;
    const ok = await onPrep(selections);
    if (ok) {
      showToast(t.prepSuccess, 'success');
      setSelected((prev) => {
        const next = new Set(prev);
        for (const l of allLines) {
          if (l.prepEligible && next.has(l.key)) next.delete(l.key);
        }
        return next;
      });
      setBottomRailOpen(true);
    }
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

  const handleSwipePrep = async (line: KitchenBoardLine) => {
    if (!line.prepEligible || prepBusy || printBusy) return;
    const ok = await onPrep([{ order_id: line.orderId, item_index: line.itemIndex }]);
    if (ok) {
      showToast(t.prepSuccess, 'success');
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(line.key);
        return next;
      });
      setBottomRailOpen(true);
    }
  };

  const openDishDetail = useCallback(
    (menuItemId: string, orderItem: KitchenBoardLine['item']) => {
      setDetailEntry(
        resolveKitchenBoardDishCatalogEntry({
          menuItemId,
          catalogById: menuCatalogById,
          orderItem,
        }),
      );
    },
    [menuCatalogById],
  );

  const thumbForLine = useCallback(
    (line: KitchenBoardLine) => {
      const entry = resolveKitchenBoardDishCatalogEntry({
        menuItemId: line.menuItemId,
        catalogById: menuCatalogById,
        orderItem: line.item,
      });
      return { imageUrl: entry.image_url, emoji: entry.emoji || line.item.emoji || '' };
    },
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
        prepBusy={prepBusy}
        printBusy={printBusy}
        thumbImageUrl={thumb.imageUrl}
        thumbEmoji={thumb.emoji}
        onOpenDetail={() => openDishDetail(line.menuItemId, line.item)}
        onToggle={() => toggleLine(line)}
        onSwipePrep={() => void handleSwipePrep(line)}
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
        <div className="flex overflow-hidden rounded-lg border border-brand-border text-lg">
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

      <div className={`flex-1 ${VERTICAL_ONLY_SCROLL}`}>
        {workbench.length === 0 ? (
          <p className="py-16 text-center text-2xl text-brand-text-muted">{t.noLines}</p>
        ) : view === 'table' ? (
          byTable.map((group) => {
            const collapsed = collapsedTables.has(group.tableId);
            const allOn = tableAllSelected(group.lines);
            return (
              <div key={group.tableId}>
                <div className="sticky top-0 z-[1] flex w-full items-center gap-2 border-b border-brand-border/60 bg-brand-bg/95 px-3 py-2 backdrop-blur-sm">
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-2xl font-medium text-brand-text"
                    onClick={() => toggleTableCollapsed(group.tableId)}
                  >
                    {group.tableDisplay}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-brand-border px-2.5 py-1 text-base font-medium text-brand-text hover:bg-brand-bg"
                    disabled={group.lines.every((l) => !l.prepEligible)}
                    onClick={() => selectAllForTable(group.lines)}
                  >
                    {allOn ? t.deselectAll : t.selectAll}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 text-base text-brand-text-muted"
                    onClick={() => toggleTableCollapsed(group.tableId)}
                  >
                    {collapsed ? t.expandGroup : t.collapseGroup}
                  </button>
                </div>
                {collapsed ? null : group.lines.map((line) => renderLine(line, 'workbench-table'))}
              </div>
            );
          })
        ) : (
          byDish.map((dish) => {
            const open = expandedDish === dish.menuItemId;
            const seedLine = dish.lines[0];
            const thumbEntry = seedLine
              ? resolveKitchenBoardDishCatalogEntry({
                  menuItemId: dish.menuItemId,
                  catalogById: menuCatalogById,
                  orderItem: seedLine.item,
                })
              : null;
            return (
              <div key={dish.menuItemId}>
                <div className="flex w-full items-center gap-3 border-b border-brand-border/50 px-2 py-2.5">
                  {thumbEntry ? (
                    <KitchenDishThumbButton
                      imageUrl={thumbEntry.image_url}
                      emoji={thumbEntry.emoji || seedLine?.item.emoji || ''}
                      ariaLabel={t.dishThumbOpenDetail}
                      onOpen={() => {
                        if (seedLine) openDishDetail(dish.menuItemId, seedLine.item);
                      }}
                    />
                  ) : null}
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left hover:bg-brand-bg/70"
                    onClick={() =>
                      setExpandedDish((prev) =>
                        prev === dish.menuItemId ? null : dish.menuItemId,
                      )
                    }
                  >
                    <span className="min-w-0 flex-1 truncate text-2xl font-medium leading-tight text-brand-text">
                      {dish.name}
                    </span>
                    <span className="shrink-0 text-xl font-semibold tabular-nums text-brand-gold">
                      {t.portionBadge.replace('{n}', String(dish.totalQty))}
                    </span>
                    <span className="shrink-0 text-xl font-semibold tabular-nums text-brand-text">
                      {t.tablesCountBadge.replace('{n}', String(dish.tableCount))}
                    </span>
                    <span className="min-w-0 max-w-[40%] truncate text-lg text-brand-text-muted">
                      {t.tablesLabel.replace('{tables}', dish.tableDisplays.join(', '))}
                    </span>
                    <span className="shrink-0 text-base text-brand-text-muted">
                      {open ? t.collapseGroup : t.expandGroup}
                    </span>
                  </button>
                </div>
                {open ? dish.lines.map((line) => renderLine(line, 'workbench-dish-l2')) : null}
              </div>
            );
          })
        )}
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
          {/* Unique footer action: rail open → print only; closed → prep only. No count badges. */}
          <div className="flex flex-wrap items-center gap-2">
            {bottomRailOpen ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={STATION_FOOTER_BTN}
                disabled={selectedPrintCount === 0 || printBusy || prepBusy}
                loading={printBusy}
                title={t.selectPrintLines}
                onClick={() => void handlePrint()}
              >
                {printBusy ? t.printBusy : t.print}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className={STATION_FOOTER_BTN}
                disabled={selectedPrepCount === 0 || prepBusy || printBusy}
                loading={prepBusy}
                title={t.selectLines}
                onClick={() => void handlePrep()}
              >
                {prepBusy ? t.prepBusy : t.prep}
              </Button>
            )}
          </div>
        </div>
      </footer>

      <KitchenMenuItemDetailModal
        open={detailEntry != null}
        entry={detailEntry}
        lang={lang}
        flavorHintsEnabled={flavorHintsEnabled}
        labels={{
          detailConfirm: t.detailConfirm,
          detailDescriptionEmpty: t.detailDescriptionEmpty,
          detailAllergensTitle: t.detailAllergensTitle,
          detailAllergensUnmarked: t.detailAllergensUnmarked,
          detailVegetarianBadge: t.detailVegetarianBadge,
        }}
        onClose={() => setDetailEntry(null)}
      />
    </section>
  );
}

/** Re-export for tests / callers that need the key helper. */
export { lineSelectionKey };
