'use client';

import { useId, useMemo } from 'react';
import {
  compareRationalSumToTarget,
  formatRational,
  normalizeRational,
  parseQtyInput,
  rationalFromNumber,
  sumRationals,
} from '@/lib/rational-qty';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';

export type ByItemDishAllocatorLabels = {
  addConsumer: string;
  namePlaceholder: string;
  qtyPlaceholder: string;
  remaining: string;
  complete: string;
  remove: string;
};

interface Props {
  itemKey: string;
  title: React.ReactNode;
  lineTotal: number;
  lineQty: number;
  rows: ByItemConsumerRow[];
  knownNames: string[];
  labels: ByItemDishAllocatorLabels;
  onChange: (rows: ByItemConsumerRow[]) => void;
}

function newRow(): ByItemConsumerRow {
  return {
    id: `row-${Math.random().toString(36).slice(2, 10)}`,
    name: '',
    qtyInput: '',
  };
}

export function ByItemDishAllocator({
  itemKey,
  title,
  lineTotal,
  lineQty,
  rows,
  knownNames,
  labels,
  onChange,
}: Props) {
  const listId = useId();

  const { allocatedLabel, isComplete, remaining } = useMemo(() => {
    const shares = rows
      .map((row) => parseQtyInput(row.qtyInput))
      .filter((qty): qty is NonNullable<typeof qty> => !!qty && qty.num > 0);
    const sum = sumRationals(shares);
    const compare = compareRationalSumToTarget(shares, lineQty);
    const remaining = remainingQty(lineQty, sum);
    return {
      allocatedLabel: formatRational(sum),
      isComplete: compare === 0,
      remaining: remaining,
    };
  }, [rows, lineQty]);

  const displayRows = rows.length > 0 ? rows : [newRow()];

  const updateRow = (rowId: string, patch: Partial<ByItemConsumerRow>) => {
    const base = rows.length > 0 ? rows : [newRow()];
    onChange(base.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    onChange([...(rows.length > 0 ? rows : [newRow()]), newRow()]);
  };

  const removeRow = (rowId: string) => {
    const next = rows.filter((row) => row.id !== rowId);
    onChange(next.length > 0 ? next : [newRow()]);
  };

  const suggestions = knownNames.filter((name) => !displayRows.some((row) => row.name.trim() === name));

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-3.5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-brand-text text-sm leading-snug">{title}</p>
          <p className={`text-[12px] mt-1 ${isComplete ? 'text-emerald-600' : 'text-brand-text-muted'}`}>
            {isComplete
              ? labels.complete
              : labels.remaining.replace('{qty}', formatRemaining(remaining))}
            {!isComplete && allocatedLabel !== '0' ? ` · ${allocatedLabel}` : ''}
          </p>
        </div>
        <span className="text-brand-gold text-[13px] shrink-0 tabular-nums">€{lineTotal.toFixed(2)}</span>
      </div>

      <div className="space-y-2">
        {displayRows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <input
              type="text"
              list={listId}
              value={row.name}
              onChange={(e) => updateRow(row.id, { name: e.target.value })}
              placeholder={labels.namePlaceholder}
              className="flex-1 min-w-0 bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-[14px] text-brand-text placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              autoComplete="off"
            />
            <input
              type="text"
              inputMode="decimal"
              value={row.qtyInput}
              onChange={(e) => updateRow(row.id, { qtyInput: e.target.value })}
              placeholder={labels.qtyPlaceholder}
              className="w-[72px] bg-brand-bg border border-brand-border rounded-lg px-2.5 py-2 text-[14px] text-brand-text text-center placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40 tabular-nums"
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              aria-label={labels.remove}
              className="w-8 h-8 shrink-0 rounded-lg text-brand-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <datalist id={listId}>
        {knownNames.map((name) => (
          <option key={`${itemKey}-${name}`} value={name} />
        ))}
      </datalist>

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {suggestions.slice(0, 8).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                const emptyRow = displayRows.find((row) => !row.name.trim());
                if (emptyRow) {
                  updateRow(emptyRow.id, { name });
                  return;
                }
                onChange([...displayRows, { ...newRow(), name }]);
              }}
              className="text-[12px] px-2.5 py-1 rounded-full bg-brand-border/70 text-brand-text-muted hover:bg-brand-gold/15 hover:text-brand-gold transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={addRow}
        className="mt-3 w-full text-brand-text-muted text-[13px] py-2 border border-dashed border-brand-border rounded-lg hover:border-brand-gold/50 hover:text-brand-gold transition-colors"
      >
        + {labels.addConsumer}
      </button>
    </div>
  );
}

function formatRemaining(value: { num: number; den: number }) {
  if (value.num <= 0) return '0';
  return formatRational(value);
}

function remainingQty(lineQty: number, allocated: { num: number; den: number }) {
  const target = rationalFromNumber(lineQty);
  return normalizeRational({
    num: target.num * allocated.den - allocated.num * target.den,
    den: target.den * allocated.den,
  });
}
