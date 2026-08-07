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

function statusClass(status: OrderItemStatus): string {
  if (status === 'ready') return 'mesa-badge-success';
  if (status === 'cooking') return 'mesa-badge-warning';
  return 'mesa-badge-danger';
}

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
      className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${
        checked ? 'border-brand-gold/50 bg-brand-gold/8' : 'border-brand-border/60'
      } ${canSelect ? 'cursor-pointer' : 'opacity-60'}`}
    >
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        disabled={!canSelect}
        onChange={onToggle}
      />
      <span className="text-lg flex-shrink-0" aria-hidden>
        {line.item.emoji || '🍽️'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-brand-text">
          <span className="mr-1.5 inline-flex min-w-[1.75rem] justify-center rounded bg-brand-gold/15 px-1.5 text-[11px] font-semibold text-brand-gold">
            {t.qtyBadge.replace('{n}', String(dishTotal))}
          </span>
          {line.item.name || line.item.name_pt}
          <span className="ml-2 text-brand-gold">× {line.item.qty}</span>
        </p>
        {line.item.note ? (
          <p className="mt-0.5 text-[12px] text-amber-800/90">{line.item.note}</p>
        ) : null}
        <span className={`mt-1 inline-flex text-[10px] px-2 py-0.5 rounded-full ${statusClass(line.effectiveStatus)}`}>
          {statusLabel(line.effectiveStatus, t)}
        </span>
      </div>
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
      className={`flex min-h-0 flex-col rounded-2xl border-2 border-brand-border bg-brand-card ${
        maximized ? 'col-span-full min-h-[70vh]' : ''
      }`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-brand-border/70 px-3 py-2.5">
        <h2 className="font-heading text-xl text-brand-gold flex-1 min-w-0 truncate">
          {stationName}
        </h2>
        <div className="flex rounded-lg border border-brand-border overflow-hidden text-[12px]">
          <button
            type="button"
            className={`px-2.5 py-1.5 ${view === 'table' ? 'bg-brand-gold/20 text-brand-text font-medium' : 'text-brand-text-muted'}`}
            onClick={() => setView('table')}
          >
            {t.viewByTable}
          </button>
          <button
            type="button"
            className={`px-2.5 py-1.5 border-l border-brand-border ${view === 'dish' ? 'bg-brand-gold/20 text-brand-text font-medium' : 'text-brand-text-muted'}`}
            onClick={() => setView('dish')}
          >
            {t.viewByDish}
          </button>
        </div>
        {canMaximize ? (
          <button
            type="button"
            className="text-[12px] text-brand-text-muted hover:text-brand-text px-2 py-1"
            onClick={onToggleMaximize}
          >
            {maximized ? t.restore : t.maximize}
          </button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
        {lines.length === 0 ? (
          <p className="text-center text-brand-text-muted py-10">{t.noLines}</p>
        ) : view === 'table' ? (
          byTable.map((group) => (
            <div key={group.tableId} className="rounded-xl border border-brand-border/70 p-2.5 space-y-2">
              <p className="font-heading text-lg text-brand-text px-0.5">{group.tableDisplay}</p>
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
              <div key={dish.menuItemId} className="rounded-xl border border-brand-border/70 overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-brand-bg/60"
                  onClick={() =>
                    setExpandedDish((prev) => (prev === dish.menuItemId ? null : dish.menuItemId))
                  }
                >
                  <span className="text-xl" aria-hidden>
                    {dish.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-brand-text">
                      {dish.name}
                      <span className="ml-2 text-brand-gold">
                        {t.qtyBadge.replace('{n}', String(dish.totalQty))}
                      </span>
                    </p>
                    <p className="text-[11px] text-brand-text-muted truncate">
                      {t.tablesLabel.replace('{tables}', dish.tableDisplays.join(', '))}
                    </p>
                  </div>
                  <span className="text-[11px] text-brand-text-muted">
                    {open ? t.collapseDish : t.expandDish}
                  </span>
                </button>
                {open ? (
                  <div className="space-y-2 border-t border-brand-border/60 p-2.5">
                    {dish.lines.map((line) => (
                      <LineRow
                        key={line.key}
                        line={line}
                        checked={selected.has(line.key)}
                        dishTotal={dish.totalQty}
                        t={t}
                        onToggle={() => toggleLine(line.key)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <footer className="flex items-center gap-3 border-t border-brand-border/70 px-3 py-2.5">
        <p className="text-[12px] text-brand-text-muted flex-1">{t.selectLines}</p>
        <Button
          type="button"
          disabled={selected.size === 0 || prepBusy}
          loading={prepBusy}
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
