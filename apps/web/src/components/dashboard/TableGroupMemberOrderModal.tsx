'use client';

import { Button } from '@/components/ui/Button';
import { DishSortOrderButtons } from '@/components/dashboard/DishSortOrderButtons';
import { Modal } from '@/components/ui/Modal';
import type { RestaurantTableGroup } from '@/lib/restaurant-table-groups';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

type Labels = {
  title: string;
  hint: string;
  moveUp: string;
  moveDown: string;
  close: string;
};

type Props = {
  open: boolean;
  group: RestaurantTableGroup | null;
  tables: RestaurantTableRow[];
  error?: string;
  labels: Labels;
  onClose: () => void;
  onMove: (tableId: string, direction: -1 | 1) => void;
};

export function TableGroupMemberOrderModal({
  open,
  group,
  tables,
  error,
  labels,
  onClose,
  onMove,
}: Props) {
  const title = group ? labels.title.replace('{name}', group.name) : labels.title;

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <p className="text-[13px] text-brand-text-muted mb-4">{labels.hint}</p>
      {error ? <p className="mesa-alert-danger text-sm px-4 py-2 mb-4">{error}</p> : null}
      <div className="max-h-[min(24rem,60vh)] overflow-y-auto rounded-lg border border-brand-border divide-y divide-brand-border/60">
        {tables.map((table, index) => (
          <div
            key={table.id}
            className="flex items-center justify-between gap-3 px-4 py-2.5 bg-brand-card"
          >
            <span className="text-sm text-brand-text font-medium tabular-nums">{table.display_name}</span>
            <DishSortOrderButtons
              index={index}
              length={tables.length}
              moveUpLabel={labels.moveUp}
              moveDownLabel={labels.moveDown}
              onMove={(dir) => onMove(table.id, dir)}
            />
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <Button variant="outline" onClick={onClose}>
          {labels.close}
        </Button>
      </div>
    </Modal>
  );
}
