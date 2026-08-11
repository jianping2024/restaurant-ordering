'use client';

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { Order, OrderItemStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import {
  aggregateLinesByDish,
  collectStationBoardLines,
  groupLinesByTable,
  lineNoteKey,
  lineSelectionKey,
  lineWaitMinutes,
  partitionStationLines,
  sumLineQty,
  type KitchenBoardLine,
} from '@/components/kitchen/kitchen-board-lines';
import { KITCHEN_SCREEN_TEXT } from '@/components/kitchen/kitchen-screen-labels';
import type { UILanguage } from '@/lib/i18n';

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
  maximized: boolean;
  canMaximize: boolean;
  onToggleMaximize: () => void;
  /** Returns true when prep API/demo succeeded. */
  onPrep: (selections: Array<{ order_id: string; item_index: number }>) => Promise<boolean>;
  prepBusy: boolean;
};

type Labels = (typeof KITCHEN_SCREEN_TEXT)[UILanguage];

const SWIPE_PREP_THRESHOLD_PX = 88;
const SWIPE_MAX_PX = 120;
/** Movement before deciding tap vs scroll vs swipe. */
const GESTURE_LOCK_SLOP_PX = 12;

/** Workbench / ready rails: vertical scroll only — bare overflow-y-auto promotes X and steals row swipe. */
const VERTICAL_ONLY_SCROLL =
  'min-h-0 overflow-y-auto overflow-x-hidden overscroll-x-none';

type RowGesture = {
  pointerId: number;
  x: number;
  y: number;
  /** Undecided until past slop; swipe only after horizontal lock. */
  mode: 'undecided' | 'swipe';
  captured: boolean;
  /** Past prep threshold while mode === 'swipe'. */
  armed: boolean;
};

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

/**
 * Sole kitchen board row UI — one order line (`orderId:itemIndex`), never merged.
 * Whole-row tap toggles select; right-swipe past threshold preps (row stays; snap-back).
 * Gesture (sole): undecided → lock horizontal then capture; vertical → abandon (no capture).
 * End (sole): `finishRowGesture` — clears active gesture first so late moves cannot rewrite dragX;
 * pointerup / cancel / lostcapture / capture-fail window end all converge here.
 */
function KitchenBoardLineRow({
  line,
  checked,
  layout,
  nowMs,
  t,
  prepBusy,
  onToggle,
  onSwipePrep,
}: {
  line: KitchenBoardLine;
  checked: boolean;
  layout: LineLayout;
  nowMs: number;
  t: Labels;
  prepBusy: boolean;
  onToggle: () => void;
  onSwipePrep: () => void;
}) {
  const note = lineNoteKey(line.item);
  const waitMin = lineWaitMinutes(line.orderedAtMs, nowMs);
  const [dragX, setDragX] = useState(0);
  const [snapping, setSnapping] = useState(false);
  const gestureRef = useRef<RowGesture | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const detachWindowEndRef = useRef<(() => void) | null>(null);
  const lineSelectableRef = useRef(line.selectable);
  const prepBusyRef = useRef(prepBusy);
  const onSwipePrepRef = useRef(onSwipePrep);
  const onToggleRef = useRef(onToggle);
  lineSelectableRef.current = line.selectable;
  prepBusyRef.current = prepBusy;
  onSwipePrepRef.current = onSwipePrep;
  onToggleRef.current = onToggle;

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
      <span className="min-w-0 flex-1 truncate text-2xl font-medium leading-tight text-brand-text">
        {line.displayName}
        {noteEl}
        <span className="ml-2 text-xl font-normal text-brand-text-muted"> {line.tableDisplay}</span>
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

  const releaseIfCaptured = useCallback((el: HTMLElement, pointerId: number, captured: boolean) => {
    if (!captured) return;
    try {
      el.releasePointerCapture(pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const detachWindowEnd = useCallback(() => {
    detachWindowEndRef.current?.();
    detachWindowEndRef.current = null;
  }, []);

  /** Animate dragX → 0; gesture must already be cleared by finishRowGesture. */
  const snapBack = useCallback((then?: () => void) => {
    setSnapping(true);
    setDragX(0);
    window.setTimeout(() => {
      setSnapping(false);
      then?.();
    }, 160);
  }, []);

  /**
   * Sole gesture terminator. Clears `gestureRef` before release/snap so
   * lostpointercapture and late pointermove cannot resurrect dragX.
   */
  const finishRowGesture = useCallback(
    (kind: 'swipe-commit' | 'swipe-abort' | 'tap' | 'abort', el?: HTMLElement | null) => {
      const g = gestureRef.current;
      if (!g) return;
      const pointerId = g.pointerId;
      const captured = g.captured;
      const mode = g.mode;
      const armed = g.armed;
      // Clear first — ended gate for all subsequent events.
      gestureRef.current = null;
      detachWindowEnd();
      const target = el ?? rowRef.current;
      if (target) releaseIfCaptured(target, pointerId, captured);

      if (mode === 'swipe') {
        const commit =
          kind === 'swipe-commit' && armed && lineSelectableRef.current && !prepBusyRef.current;
        snapBack(commit ? () => onSwipePrepRef.current() : undefined);
        return;
      }
      setDragX(0);
      if (kind === 'tap' && lineSelectableRef.current && !prepBusyRef.current) {
        onToggleRef.current();
      }
    },
    [detachWindowEnd, releaseIfCaptured, snapBack],
  );

  const attachWindowEndIfUncaptured = useCallback(
    (pointerId: number) => {
      detachWindowEnd();
      const onEnd = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const cur = gestureRef.current;
        if (!cur || cur.pointerId !== pointerId) return;
        const kind =
          cur.mode === 'swipe' && cur.armed ? 'swipe-commit' : cur.mode === 'swipe' ? 'swipe-abort' : 'abort';
        finishRowGesture(kind, rowRef.current);
      };
      window.addEventListener('pointerup', onEnd, true);
      window.addEventListener('pointercancel', onEnd, true);
      detachWindowEndRef.current = () => {
        window.removeEventListener('pointerup', onEnd, true);
        window.removeEventListener('pointercancel', onEnd, true);
      };
    },
    [detachWindowEnd, finishRowGesture],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!line.selectable || prepBusy || snapping) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('input')) return;
    // Orphan translate (no active gesture) — reset before a new gesture.
    if (dragX !== 0 && !gestureRef.current) setDragX(0);
    // Do not capture yet — leave the list free to scroll until horizontal lock.
    gestureRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      mode: 'undecided',
      captured: false,
      armed: false,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (g.mode === 'undecided') {
      if (absX < GESTURE_LOCK_SLOP_PX && absY < GESTURE_LOCK_SLOP_PX) return;
      // Vertical (or diagonal-up/down) → abandon; never captured, scroll stays native.
      if (absY >= absX) {
        gestureRef.current = null;
        return;
      }
      // Horizontal lock: capture only now.
      g.mode = 'swipe';
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
        g.captured = true;
      } catch {
        g.captured = false;
      }
      // Capture failed → element may miss pointerup; window end shares finishRowGesture.
      if (!g.captured) attachWindowEndIfUncaptured(e.pointerId);
    }

    if (g.mode !== 'swipe') return;
    if (e.cancelable) e.preventDefault();
    const next = Math.max(0, Math.min(dx, SWIPE_MAX_PX));
    setDragX(next);
    g.armed = next >= SWIPE_PREP_THRESHOLD_PX;
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (g.mode === 'swipe') {
      finishRowGesture(g.armed ? 'swipe-commit' : 'swipe-abort', e.currentTarget);
      return;
    }
    finishRowGesture('tap', e.currentTarget);
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    finishRowGesture(g.mode === 'swipe' ? 'swipe-abort' : 'abort', e.currentTarget);
  };

  /** Browser stole capture (or we released after clear) — only acts while gesture still live. */
  const onLostPointerCapture = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    finishRowGesture(g.mode === 'swipe' ? 'swipe-abort' : 'abort', e.currentTarget);
  };

  return (
    <div
      ref={rowRef}
      role="presentation"
      className={`flex min-w-0 w-full max-w-full items-center gap-3 border-b border-brand-border/50 px-2 py-2.5 ${
        checked ? 'bg-brand-bg ring-1 ring-inset ring-brand-gold/50' : 'bg-brand-card'
      } ${line.selectable ? '' : 'opacity-55'} ${
        snapping || dragX === 0 ? 'transition-transform duration-150 ease-out' : ''
      }`}
      style={{ transform: `translateX(${dragX}px)`, touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
    >
      <input
        type="checkbox"
        className="h-6 w-6 shrink-0"
        checked={checked}
        disabled={!line.selectable}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        aria-label={line.displayName}
      />
      {title}
      <span className="shrink-0 text-xl font-semibold tabular-nums text-brand-gold">
        × {Number(line.item.qty) || 0}
      </span>
      <span
        className="shrink-0 text-lg tabular-nums text-brand-text-muted"
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
  );
}

export function KitchenStationPane({
  stationId,
  stationName,
  orders,
  readyAfterMinutes,
  nowMs,
  lang,
  maximized,
  canMaximize,
  onToggleMaximize,
  onPrep,
  prepBusy,
}: Props) {
  const t = KITCHEN_SCREEN_TEXT[lang];
  const [view, setView] = useState<PaneView>('table');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [expandedDish, setExpandedDish] = useState<string | null>(null);
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(() => new Set());
  const [readyRailOpen, setReadyRailOpen] = useState(false);

  const allLines = useMemo(
    () =>
      collectStationBoardLines({
        orders,
        printStationId: stationId,
        nowMs,
        readyAfterMinutes,
      }),
    [orders, stationId, nowMs, readyAfterMinutes],
  );

  const { workbench, ready } = useMemo(() => partitionStationLines(allLines), [allLines]);
  const byTable = useMemo(() => groupLinesByTable(workbench), [workbench]);
  const byDish = useMemo(() => aggregateLinesByDish(workbench), [workbench]);
  const readyQty = useMemo(() => sumLineQty(ready), [ready]);

  const toggleLine = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllForTable = (lines: KitchenBoardLine[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const selectable = lines.filter((l) => l.selectable);
      const allOn = selectable.length > 0 && selectable.every((l) => next.has(l.key));
      for (const l of selectable) {
        if (allOn) next.delete(l.key);
        else next.add(l.key);
      }
      return next;
    });
  };

  const tableAllSelected = (lines: KitchenBoardLine[]) => {
    const selectable = lines.filter((l) => l.selectable);
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

  const handlePrep = async () => {
    const selections = allLines
      .filter((l) => selected.has(l.key))
      .map((l) => ({ order_id: l.orderId, item_index: l.itemIndex }));
    if (selections.length === 0) return;
    const ok = await onPrep(selections);
    if (ok) {
      showToast(t.prepSuccess, 'success');
      setSelected(new Set());
    }
  };

  const handleSwipePrep = async (line: KitchenBoardLine) => {
    if (!line.selectable || prepBusy) return;
    const ok = await onPrep([{ order_id: line.orderId, item_index: line.itemIndex }]);
    if (ok) {
      showToast(t.prepSuccess, 'success');
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(line.key);
        return next;
      });
    }
  };

  const renderLine = (line: KitchenBoardLine, layout: LineLayout) => (
    <KitchenBoardLineRow
      key={line.key}
      line={line}
      checked={selected.has(line.key)}
      layout={layout}
      nowMs={nowMs}
      t={t}
      prepBusy={prepBusy}
      onToggle={() => toggleLine(line.key)}
      onSwipePrep={() => void handleSwipePrep(line)}
    />
  );

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col bg-brand-card ${
        maximized ? 'h-full border-0' : 'rounded-xl border border-brand-border'
      }`}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-brand-border/70 px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate font-heading text-3xl text-brand-gold">
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
                    disabled={group.lines.every((l) => !l.selectable)}
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
            return (
              <div key={dish.menuItemId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 border-b border-brand-border/50 px-2 py-2.5 text-left hover:bg-brand-bg/70"
                  onClick={() =>
                    setExpandedDish((prev) => (prev === dish.menuItemId ? null : dish.menuItemId))
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
                {open ? dish.lines.map((line) => renderLine(line, 'workbench-dish-l2')) : null}
              </div>
            );
          })
        )}
      </div>

      <footer className="flex shrink-0 flex-col border-t border-brand-border/70">
        {readyRailOpen ? (
          <div className={`max-h-64 border-b border-brand-border/60 bg-brand-bg/40 ${VERTICAL_ONLY_SCROLL}`}>
            {ready.length === 0 ? (
              <p className="px-3 py-4 text-center text-xl text-brand-text-muted">{t.readyRailEmpty}</p>
            ) : (
              ready.map((line) => renderLine(line, 'ready'))
            )}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <Button
            type="button"
            variant="outline"
            className="min-h-12 px-5 text-xl"
            disabled={readyQty === 0 && !readyRailOpen}
            onClick={() => setReadyRailOpen((v) => !v)}
          >
            {readyRailOpen
              ? t.readyRailHide
              : t.readyRailShow.replace('{n}', String(readyQty))}
          </Button>
          <Button
            type="button"
            className="min-h-12 px-6 text-xl"
            disabled={selected.size === 0 || prepBusy}
            loading={prepBusy}
            title={t.selectLines}
            onClick={() => void handlePrep()}
          >
            {prepBusy ? t.prepBusy : t.prep}
            {selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
        </div>
      </footer>
    </section>
  );
}

/** Re-export for tests / callers that need the key helper. */
export { lineSelectionKey };
