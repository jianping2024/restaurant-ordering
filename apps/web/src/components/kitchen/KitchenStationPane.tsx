'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { Order, OrderItemStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import {
  accumulateRowsByTableDishStatusNote,
  aggregateLinesByDish,
  collectStationBoardLines,
  groupLinesByTable,
  lineSelectionKey,
  partitionStationLines,
  stationDishTotalQty,
  sumLineQty,
  type AccumulatedTableRow,
} from '@/components/kitchen/kitchen-board-lines';
import { KITCHEN_SCREEN_TEXT } from '@/components/kitchen/kitchen-screen-labels';
import type { UILanguage } from '@/lib/i18n';

type PaneView = 'table' | 'dish';

/** One UI shape for every selectable kitchen row (workbench + ready rail). */
type AccumulatedLayout = 'workbench-table' | 'workbench-dish-l2' | 'ready';

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
  onPrep: (selections: Array<{ order_id: string; item_index: number }>) => Promise<void>;
  prepBusy: boolean;
};

type Labels = (typeof KITCHEN_SCREEN_TEXT)[UILanguage];

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
 * Accumulated selectable row — sole workbench/ready line UI.
 * Merge key (elsewhere): menuItemId × tableId × status × note (trim); different notes never merge.
 */
function AccumulatedRow({
  row,
  checked,
  layout,
  dishTotal,
  t,
  onToggle,
}: {
  row: AccumulatedTableRow;
  checked: boolean;
  layout: AccumulatedLayout;
  /** Workbench-table only: station workbench total for this dish. */
  dishTotal?: number;
  t: Labels;
  onToggle: () => void;
}) {
  const selectable = row.lines.some((l) => l.selectable);
  const noteEl = row.note ? (
    <span className="ml-2 text-xl font-normal text-amber-800/90">· {row.note}</span>
  ) : null;

  let title: ReactNode;
  if (layout === 'workbench-table') {
    title = (
      <span className="min-w-0 flex-1 truncate text-2xl font-medium leading-tight text-brand-text">
        {row.name}
        {noteEl}
      </span>
    );
  } else if (layout === 'ready') {
    title = (
      <span className="min-w-0 flex-1 truncate text-2xl font-medium leading-tight text-brand-text">
        {row.name}
        {noteEl}
        <span className="ml-2 text-xl font-normal text-brand-text-muted">
          {' '}
          {row.tableDisplay}
        </span>
      </span>
    );
  } else {
    title = (
      <span className="min-w-0 flex-1 truncate text-2xl font-medium leading-tight text-brand-text">
        {row.tableDisplay}
        {noteEl}
      </span>
    );
  }

  return (
    <label
      className={`flex items-center gap-3 border-b border-brand-border/50 px-2 py-2.5 ${
        checked ? 'bg-brand-gold/12' : 'hover:bg-brand-bg/70'
      } ${selectable ? 'cursor-pointer' : 'opacity-55'}`}
    >
      <input
        type="checkbox"
        className="h-5 w-5 shrink-0"
        checked={checked}
        disabled={!selectable}
        onChange={onToggle}
      />
      {layout === 'workbench-table' && dishTotal != null ? (
        <span className="shrink-0 min-w-[3rem] text-center text-xl font-semibold tabular-nums text-brand-gold">
          {t.qtyBadge.replace('{n}', String(dishTotal))}
        </span>
      ) : null}
      {title}
      <span className="shrink-0 text-xl font-semibold tabular-nums text-brand-gold">
        × {row.qty}
      </span>
      <span
        className={`shrink-0 rounded-md px-2 py-0.5 text-lg font-medium ${statusTone(row.effectiveStatus)}`}
      >
        {statusLabel(row.effectiveStatus, t)}
      </span>
    </label>
  );
}

function rowFullySelected(row: AccumulatedTableRow, selected: Set<string>): boolean {
  return row.lineKeys.length > 0 && row.lineKeys.every((k) => selected.has(k));
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
  const readyRows = useMemo(() => accumulateRowsByTableDishStatusNote(ready), [ready]);
  const readyQty = useMemo(() => sumLineQty(ready), [ready]);

  const toggleAccumulated = (row: AccumulatedTableRow) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = row.lineKeys.every((k) => next.has(k));
      for (const k of row.lineKeys) {
        if (allOn) next.delete(k);
        else next.add(k);
      }
      return next;
    });
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
    await onPrep(selections);
    setSelected(new Set());
  };

  return (
    <section
      className={`flex min-h-0 flex-col bg-brand-card ${
        maximized
          ? 'h-full border-0'
          : 'rounded-xl border border-brand-border'
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {workbench.length === 0 ? (
          <p className="py-16 text-center text-2xl text-brand-text-muted">{t.noLines}</p>
        ) : view === 'table' ? (
          byTable.map((group) => {
            const collapsed = collapsedTables.has(group.tableId);
            const rows = accumulateRowsByTableDishStatusNote(group.lines);
            return (
              <div key={group.tableId}>
                <button
                  type="button"
                  className="sticky top-0 z-[1] flex w-full items-center gap-2 border-b border-brand-border/60 bg-brand-bg/95 px-3 py-2 text-left backdrop-blur-sm"
                  onClick={() => toggleTableCollapsed(group.tableId)}
                >
                  <span className="min-w-0 flex-1 truncate text-2xl font-medium text-brand-text">
                    {group.tableDisplay}
                  </span>
                  <span className="shrink-0 text-base text-brand-text-muted">
                    {collapsed ? t.expandGroup : t.collapseGroup}
                  </span>
                </button>
                {collapsed
                  ? null
                  : rows.map((row) => (
                      <AccumulatedRow
                        key={row.key}
                        row={row}
                        checked={rowFullySelected(row, selected)}
                        layout="workbench-table"
                        dishTotal={stationDishTotalQty(workbench, row.menuItemId)}
                        t={t}
                        onToggle={() => toggleAccumulated(row)}
                      />
                    ))}
              </div>
            );
          })
        ) : (
          byDish.map((dish) => {
            const open = expandedDish === dish.menuItemId;
            const tableRows = accumulateRowsByTableDishStatusNote(dish.lines);
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
                    {t.qtyBadge.replace('{n}', String(dish.totalQty))}
                  </span>
                  <span className="min-w-0 max-w-[40%] truncate text-lg text-brand-text-muted">
                    {t.tablesLabel.replace('{tables}', dish.tableDisplays.join(', '))}
                  </span>
                  <span className="shrink-0 text-base text-brand-text-muted">
                    {open ? t.collapseGroup : t.expandGroup}
                  </span>
                </button>
                {open
                  ? tableRows.map((row) => (
                      <AccumulatedRow
                        key={row.key}
                        row={row}
                        checked={rowFullySelected(row, selected)}
                        layout="workbench-dish-l2"
                        t={t}
                        onToggle={() => toggleAccumulated(row)}
                      />
                    ))
                  : null}
              </div>
            );
          })
        )}
      </div>

      <footer className="flex shrink-0 flex-col border-t border-brand-border/70">
        {readyRailOpen ? (
          <div className="max-h-64 min-h-0 overflow-y-auto border-b border-brand-border/60 bg-brand-bg/40">
            {readyRows.length === 0 ? (
              <p className="px-3 py-4 text-center text-xl text-brand-text-muted">{t.readyRailEmpty}</p>
            ) : (
              readyRows.map((row) => (
                <AccumulatedRow
                  key={row.key}
                  row={row}
                  checked={rowFullySelected(row, selected)}
                  layout="ready"
                  t={t}
                  onToggle={() => toggleAccumulated(row)}
                />
              ))
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
