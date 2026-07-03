'use client';

import { useMemo } from 'react';
import {
  byItemLineStatusSummary,
  createByItemConsumerRow,
  getByItemLineStatusFromRows,
  removeByItemConsumerRow,
  getQtyPartsRowHint,
  isRowQtyOverAllocated,
  type ByItemConsumerRow,
  type ByItemLineStatusLabels,
  type QtyPartsLabels,
} from '@/lib/bill-split-by-item';
import { availableConsumerNamesForRow } from '@/lib/consumer-name-roster';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { BuffetDishAllocator, type BuffetDishAllocatorLabels } from '@/components/menu/BuffetDishAllocator';
import { ByItemConsumerRowRemoveButton } from '@/components/menu/ByItemConsumerRowRemoveButton';
import { ByItemDishAllocatorHeader } from '@/components/menu/ByItemDishAllocatorHeader';
import { ConsumerNameCombobox } from '@/components/menu/ConsumerNameCombobox';
import { ByItemQtyInput } from '@/components/menu/ByItemQtyInput';

export type ByItemDishAllocatorLabels = ByItemLineStatusLabels & QtyPartsLabels & Omit<BuffetDishAllocatorLabels, 'expandDetails' | 'collapseDetails'> & {
  expandDetails: string;
  collapseDetails: string;
};

interface Props {
  title: React.ReactNode;
  spec: ByItemLineSpec;
  rows: ByItemConsumerRow[];
  consumerRoster: string[];
  labels: ByItemDishAllocatorLabels;
  readOnly?: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (rows: ByItemConsumerRow[]) => void;
  onRememberConsumerName: (name: string, fromList: boolean) => void;
}

export function ByItemDishAllocator({
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
  if (spec.mode === 'buffet') {
    return (
      <BuffetDishAllocator
        title={title}
        spec={spec}
        rows={rows}
        consumerRoster={consumerRoster}
        labels={labels}
        readOnly={readOnly}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        onChange={onChange}
        onRememberConsumerName={onRememberConsumerName}
      />
    );
  }

  return (
    <MenuByItemDishAllocator
      title={title}
      spec={spec}
      rows={rows}
      consumerRoster={consumerRoster}
      labels={labels}
      readOnly={readOnly}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      onChange={onChange}
      onRememberConsumerName={onRememberConsumerName}
    />
  );
}

function MenuByItemDishAllocator({
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
}: Props & { spec: Extract<ByItemLineSpec, { mode: 'menu' }> }) {
  const lineQty = spec.lineQty;
  const lineTotal = spec.lineTotal;
  const lineStatus = useMemo(
    () => getByItemLineStatusFromRows(rows, spec),
    [rows, spec],
  );

  const statusSummary = useMemo(
    () => byItemLineStatusSummary(lineStatus, labels, labels),
    [lineStatus, labels],
  );

  const updateRow = (rowId: string, patch: Partial<ByItemConsumerRow>) => {
    onChange(rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    onChange([...rows, createByItemConsumerRow()]);
  };

  const removeRow = (rowId: string) => {
    onChange(removeByItemConsumerRow(rows, rowId));
  };

  const qtyLabels: QtyPartsLabels = {
    wholePlaceholder: labels.wholePlaceholder,
    numPlaceholder: labels.numPlaceholder,
    denPlaceholder: labels.denPlaceholder,
    missingDen: labels.missingDen,
    zeroDen: labels.zeroDen,
    improperFraction: labels.improperFraction,
  };

  return (
    <div
      className={`bg-brand-card border rounded-xl p-3.5 ${
        statusSummary.tone === 'alert'
          ? 'border-red-500/40 ring-1 ring-red-500/20'
          : 'border-brand-border'
      }${readOnly ? ' opacity-60 pointer-events-none' : ''}`}
    >
      <ByItemDishAllocatorHeader
        title={title}
        statusSummary={statusSummary}
        lineTotal={lineTotal}
        expanded={expanded}
        expandLabel={labels.expandDetails}
        collapseLabel={labels.collapseDetails}
        onToggleExpand={onToggleExpand}
      />

      {expanded ? (
        <>
          <div className="space-y-2">
            {rows.map((row) => {
              const qtyInvalid = !!getQtyPartsRowHint(row, qtyLabels);
              const qtyOver = isRowQtyOverAllocated(row, rows, lineQty);
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
                  <ByItemQtyInput
                    row={row}
                    labels={qtyLabels}
                    invalid={qtyInvalid || qtyOver}
                    onChange={(patch) => updateRow(row.id, patch)}
                  />
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
        </>
      ) : null}
    </div>
  );
}
