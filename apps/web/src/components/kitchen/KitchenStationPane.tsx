'use client';

import { useMemo, useState } from 'react';
import type { Order, OrderItemStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import {
  aggregateLinesByDish,
  collectStationBoardLines,
  groupLinesByTable,
  lineSelectionKey,
  stationDishTotalQty,
  type KitchenBoardLine,
} from '@/components/kitchen/kitchen-board-lines';
import { KITCHEN_SCREEN_TEXT } from '@/components/kitchen/kitchen-screen-labels';
import type { UILanguage } from '@/lib/i18n';

type PaneView = 'table' | 'dish';

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

function statusLabel(
  status: OrderItemStatus,
  t: (typeof KITCHEN_SCREEN_TEXT)[UILanguage],
): string {
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

/** One dish = one horizontal row (no nested card, no wrapped status block). */
function LineRow({
  line,
  checked,
  dishTotal,
  t,
  onToggle,
}: {
  line: KitchenBoardLine;
  checked: boolean;
  dishTotal: number;
  t: (typeof KITCHEN_SCREEN_TEXT)[UILanguage];
  onToggle: () => void;
}) {
  const canSelect =
    line.effectiveStatus === 'pending' ||
    line.effectiveStatus === 'cooking' ||
    line.effectiveStatus === 'ready';
  return (
    <label
      className={`flex items-center gap-3 border-b border-brand-border/50 px-2 py-2.5 ${
        checked ? 'bg-brand-gold/12' : 'hover:bg-brand-bg/70'
      } ${canSelect ? 'cursor-pointer' : 'opacity-55'}`}
    >
      <input
        type="checkbox"
        className="h-5 w-5 shrink-0"
        checked={checked}
        disabled={!canSelect}
        onChange={onToggle}
      />
      <span className="shrink-0 min-w-[3rem] text-center text-xl font-semibold tabular-nums text-brand-gold">
        {t.qtyBadge.replace('{n}', String(dishTotal))}
      </span>
      <span className="min-w-0 flex-1 truncate text-2xl font-medium leading-tight text-brand-text">
        {line.item.name || line.item.name_pt}
        {line.item.note ? (
          <span className="ml-2 text-xl font-normal text-amber-800/90">· {line.item.note}</span>
        ) : null}
      </span>
      {/* Qty secondary to dish name — text-2xl was reading larger than the name on KDS. */}
      <span className="shrink-0 text-xl font-semibold tabular-nums text-brand-gold">
        × {line.item.qty}
      </span>
      <span
        className={`shrink-0 rounded-md px-2 py-0.5 text-lg font-medium ${statusTone(line.effectiveStatus)}`}
      >
        {statusLabel(line.effectiveStatus, t)}
      </span>
    </label>
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

  const lines = useMemo(
    () =>
      collectStationBoardLines({
        orders,
        printStationId: stationId,
        nowMs,
        readyAfterMinutes,
      }),
    [orders, stationId, nowMs, readyAfterMinutes],
  );

  const byTable = useMemo(() => groupLinesByTable(lines), [lines]);
  const byDish = useMemo(() => aggregateLinesByDish(lines), [lines]);

  const toggleLine = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handlePrep = async () => {
    const selections = lines
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
        {lines.length === 0 ? (
          <p className="py-16 text-center text-2xl text-brand-text-muted">{t.noLines}</p>
        ) : view === 'table' ? (
          byTable.map((group) => (
            <div key={group.tableId}>
              <p className="sticky top-0 z-[1] border-b border-brand-border/60 bg-brand-bg/95 px-3 py-2 font-heading text-3xl text-brand-text backdrop-blur-sm">
                {group.tableDisplay}
              </p>
              {group.lines.map((line) => (
                <LineRow
                  key={line.key}
                  line={line}
                  checked={selected.has(line.key)}
                  dishTotal={stationDishTotalQty(lines, line.menuItemId)}
                  t={t}
                  onToggle={() => toggleLine(line.key)}
                />
              ))}
            </div>
          ))
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
                    {t.qtyBadge.replace('{n}', String(dish.totalQty))}
                  </span>
                  <span className="min-w-0 max-w-[40%] truncate text-lg text-brand-text-muted">
                    {t.tablesLabel.replace('{tables}', dish.tableDisplays.join(', '))}
                  </span>
                  <span className="shrink-0 text-base text-brand-text-muted">
                    {open ? t.collapseDish : t.expandDish}
                  </span>
                </button>
                {open
                  ? dish.lines.map((line) => (
                      <LineRow
                        key={line.key}
                        line={line}
                        checked={selected.has(line.key)}
                        dishTotal={dish.totalQty}
                        t={t}
                        onToggle={() => toggleLine(line.key)}
                      />
                    ))
                  : null}
              </div>
            );
          })
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-end border-t border-brand-border/70 px-3 py-2.5">
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
      </footer>
    </section>
  );
}

/** Re-export for tests / callers that need the key helper. */
export { lineSelectionKey };
