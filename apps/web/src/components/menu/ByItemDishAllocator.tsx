'use client';

import { useMemo } from 'react';
import {
  compareRationalSumToTarget,
  formatRational,
  normalizeRational,
  parseQtyInput,
  rationalFromNumber,
  sumRationals,
} from '@/lib/rational-qty';
import {
  createByItemConsumerRow,
  type ByItemConsumerRow,
} from '@/lib/bill-split-by-item';
import { availableConsumerNamesForRow } from '@/lib/consumer-name-roster';
import { ConsumerNameCombobox } from '@/components/menu/ConsumerNameCombobox';

export type ByItemDishAllocatorLabels = {
  addConsumer: string;
  namePlaceholder: string;
  qtyPlaceholder: string;
  remaining: string;
  complete: string;
  remove: string;
};

interface Props {
  title: React.ReactNode;
  lineTotal: number;
  lineQty: number;
  rows: ByItemConsumerRow[];
  consumerRoster: string[];
  labels: ByItemDishAllocatorLabels;
  onChange: (rows: ByItemConsumerRow[]) => void;
  onRememberConsumerName: (name: string, fromList: boolean) => void;
}

export function ByItemDishAllocator({
  title,
  lineTotal,
  lineQty,
  rows,
  consumerRoster,
  labels,
  onChange,
  onRememberConsumerName,
}: Props) {
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

  const updateRow = (rowId: string, patch: Partial<ByItemConsumerRow>) => {
    onChange(rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    onChange([...rows, createByItemConsumerRow()]);
  };

  const removeRow = (rowId: string) => {
    const next = rows.filter((row) => row.id !== rowId);
    onChange(next.length > 0 ? next : [createByItemConsumerRow()]);
  };

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
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <ConsumerNameCombobox
              value={row.name}
              options={availableConsumerNamesForRow({
                roster: consumerRoster,
                dishRows: rows,
                rowId: row.id,
              })}
              placeholder={labels.namePlaceholder}
              onChange={(name) => updateRow(row.id, { name })}
              onCommit={(name, fromList) => onRememberConsumerName(name, fromList)}
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
