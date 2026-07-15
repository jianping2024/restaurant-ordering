'use client';

import { useMemo } from 'react';
import {
  appendByItemConsumerRow,
  byItemLineStatusSummary,
  getByItemLineStatusFromRows,
  removeByItemConsumerRow,
  getQtyPartsRowHint,
  isRowQtyOverAllocated,
  type ByItemConsumerRow,
  type ByItemLineStatusLabels,
  type QtyPartsLabels,
} from '@/lib/bill-split-by-item';
import {
  byItemRowEditLock,
  clampMenuRowToMinQty,
  type LockedPersonLineMins,
} from '@/lib/checkout-split-continuation';
import { availableConsumerNamesForRow } from '@/lib/consumer-name-roster';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { BuffetDishAllocator, type BuffetDishAllocatorLabels } from '@/components/menu/BuffetDishAllocator';
import { ByItemConsumerRowRemoveButton } from '@/components/menu/ByItemConsumerRowRemoveButton';
import {
  ByItemDishAllocatorHeader,
  type ByItemDishAllocatorHeaderLabels,
} from '@/components/menu/ByItemDishAllocatorHeader';
import { ByItemDishAllocatorShell } from '@/components/menu/ByItemDishAllocatorShell';
import { ConsumerNameCombobox } from '@/components/menu/ConsumerNameCombobox';
import { ByItemQtyInput } from '@/components/menu/ByItemQtyInput';

export type ByItemDishAllocatorLabels = ByItemLineStatusLabels &
  QtyPartsLabels &
  BuffetDishAllocatorLabels &
  ByItemDishAllocatorHeaderLabels;

interface Props {
  title: React.ReactNode;
  spec: ByItemLineSpec;
  rows: ByItemConsumerRow[];
  consumerRoster: string[];
  labels: ByItemDishAllocatorLabels;
  lockedPersonLineMins?: LockedPersonLineMins;
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
  lockedPersonLineMins,
  expanded,
  onToggleExpand,
  onChange,
  onRememberConsumerName,
}: Props) {
  const locks = lockedPersonLineMins ?? { menu: new Map(), buffet: new Map() };

  if (spec.mode === 'buffet') {
    return (
      <BuffetDishAllocator
        title={title}
        spec={spec}
        rows={rows}
        consumerRoster={consumerRoster}
        labels={labels}
        lockedPersonLineMins={locks}
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
      lockedPersonLineMins={locks}
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
  lockedPersonLineMins,
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
    onChange(rows.map((row) => {
      if (row.id !== rowId) return row;
      const next = { ...row, ...patch };
      const lock = byItemRowEditLock({
        lineKey: spec.key,
        row: next,
        locks: lockedPersonLineMins ?? { menu: new Map(), buffet: new Map() },
        spec,
      });
      return clampMenuRowToMinQty(next, lock.minMenuQty);
    }));
  };

  const addRow = () => {
    onChange(appendByItemConsumerRow(rows, spec));
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

  const locks = lockedPersonLineMins ?? { menu: new Map(), buffet: new Map() };

  return (
    <ByItemDishAllocatorShell
      statusTone={statusSummary.tone}
      expanded={expanded}
      header={(
        <ByItemDishAllocatorHeader
          title={title}
          statusSummary={statusSummary}
          lineTotal={lineTotal}
          expanded={expanded}
          labels={labels}
          onToggleExpand={onToggleExpand}
        />
      )}
    >
      <div className="space-y-2">
        {rows.map((row) => {
          const rowLock = byItemRowEditLock({ lineKey: spec.key, row, locks, spec });
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
                readOnly={rowLock.nameReadOnly}
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
                removable={rowLock.removable && rows.length > 1}
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
