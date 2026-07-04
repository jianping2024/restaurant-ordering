'use client';

import { useMemo } from 'react';
import {
  appendByItemConsumerRow,
  byItemLineStatusSummary,
  getBuffetLineStatusFromRows,
  removeByItemConsumerRow,
  resolveBuffetRowCounts,
  sanitizeQtyDigits,
  type ByItemConsumerRow,
  type ByItemLineStatusLabels,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { availableConsumerNamesForRow } from '@/lib/consumer-name-roster';
import { ByItemConsumerRowRemoveButton } from '@/components/menu/ByItemConsumerRowRemoveButton';
import {
  ByItemDishAllocatorHeader,
  type ByItemDishAllocatorHeaderLabels,
} from '@/components/menu/ByItemDishAllocatorHeader';
import { ByItemDishAllocatorShell } from '@/components/menu/ByItemDishAllocatorShell';
import { ConsumerNameCombobox } from '@/components/menu/ConsumerNameCombobox';

export type BuffetDishAllocatorLabels = ByItemLineStatusLabels & {
  addConsumer: string;
  namePlaceholder: string;
  remove: string;
  buffetAdultQtyLabel: string;
  buffetChildQtyLabel: string;
};

interface Props {
  title: React.ReactNode;
  spec: Extract<ByItemLineSpec, { mode: 'buffet' }>;
  rows: ByItemConsumerRow[];
  consumerRoster: string[];
  labels: BuffetDishAllocatorLabels & ByItemDishAllocatorHeaderLabels;
  readOnly?: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (rows: ByItemConsumerRow[]) => void;
  onRememberConsumerName: (name: string, fromList: boolean) => void;
}

const INPUT_CLASS =
  'w-10 bg-brand-bg border rounded-lg py-2 text-[14px] text-brand-text text-center placeholder:text-brand-muted focus:outline-none focus:ring-2 tabular-nums';
const INPUT_OK = `${INPUT_CLASS} border-brand-border focus:ring-brand-gold/40`;
const INPUT_ALERT = `${INPUT_CLASS} border-red-500 focus:ring-red-500/40`;

function isRowBuffetOverAllocated(
  row: ByItemConsumerRow,
  rows: ByItemConsumerRow[],
  spec: { adults: number; children: number },
): boolean {
  const { adults, children } = resolveBuffetRowCounts(row);
  if (adults <= 0 && children <= 0) return false;
  const others = rows
    .filter((candidate) => candidate.id !== row.id)
    .reduce(
      (totals, candidate) => {
        const counts = resolveBuffetRowCounts(candidate);
        totals.adults += counts.adults;
        totals.children += counts.children;
        return totals;
      },
      { adults: 0, children: 0 },
    );
  return others.adults + adults > spec.adults || others.children + children > spec.children;
}

export function BuffetDishAllocator({
  title,
  spec,
  rows,
  consumerRoster,
  labels,
  readOnly = false,
  expanded,
  onToggleExpand,
  onChange,
  onRememberConsumerName,
}: Props) {
  const lineStatus = useMemo(
    () => getBuffetLineStatusFromRows(rows, spec),
    [rows, spec],
  );

  const statusSummary = useMemo(
    () => byItemLineStatusSummary(lineStatus, labels, undefined, { buffet: true }),
    [lineStatus, labels],
  );

  const updateRow = (rowId: string, patch: Partial<ByItemConsumerRow>) => {
    onChange(rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    onChange(appendByItemConsumerRow(rows, spec));
  };

  const removeRow = (rowId: string) => {
    onChange(removeByItemConsumerRow(rows, rowId, { buffet: true }));
  };

  return (
    <ByItemDishAllocatorShell
      statusTone={statusSummary.tone}
      readOnly={readOnly}
      expanded={expanded}
      header={(
        <ByItemDishAllocatorHeader
          title={title}
          statusSummary={statusSummary}
          lineTotal={spec.lineTotal}
          expanded={expanded}
          labels={labels}
          onToggleExpand={onToggleExpand}
        />
      )}
    >
      <div className="space-y-2">
        {rows.map((row) => {
          const over = isRowBuffetOverAllocated(row, rows, spec);
          const fieldClass = over ? INPUT_ALERT : INPUT_OK;
          return (
            <div key={row.id} className="flex items-start gap-2">
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
              <div className="flex shrink-0 items-center gap-1">
                <label className="flex items-center gap-1 text-[11px] text-brand-text-muted">
                  <span className="whitespace-nowrap">{labels.buffetAdultQtyLabel}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={row.adultQty ?? ''}
                    onChange={(e) => updateRow(row.id, {
                      adultQty: sanitizeQtyDigits(e.target.value),
                    })}
                    aria-label={labels.buffetAdultQtyLabel}
                    className={fieldClass}
                  />
                </label>
                <label className="flex items-center gap-1 text-[11px] text-brand-text-muted">
                  <span className="whitespace-nowrap">{labels.buffetChildQtyLabel}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={row.childQty ?? ''}
                    onChange={(e) => updateRow(row.id, {
                      childQty: sanitizeQtyDigits(e.target.value),
                    })}
                    aria-label={labels.buffetChildQtyLabel}
                    className={fieldClass}
                  />
                </label>
              </div>
              <ByItemConsumerRowRemoveButton
                rowCount={rows.length}
                ariaLabel={labels.remove}
                onRemove={() => removeRow(row.id)}
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="mt-3 w-full text-brand-text-muted text-[13px] py-2 border border-dashed border-brand-border rounded-lg hover:border-brand-gold/50 hover:text-brand-gold transition-colors"
      >
        + {labels.addConsumer}
      </button>
    </ByItemDishAllocatorShell>
  );
}
