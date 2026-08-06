'use client';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SortOrderDragHandle } from '@/components/dashboard/SortOrderDragHandle';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import type { RestaurantTableGroup } from '@/lib/restaurant-table-groups';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

type Labels = {
  title: string;
  hint: string;
  close: string;
};

type Props = {
  open: boolean;
  group: RestaurantTableGroup | null;
  tables: RestaurantTableRow[];
  error?: string;
  busy?: boolean;
  labels: Labels;
  onClose: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

export function TableGroupMemberOrderModal({
  open,
  group,
  tables,
  error,
  busy = false,
  labels,
  onClose,
  onReorder,
}: Props) {
  const title = group ? labels.title.replace('{name}', group.name) : labels.title;
  const canReorder = tables.length >= 2;

  const onDragEnd = (result: DropResult) => {
    if (!canReorder || busy) return;
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    onReorder(result.source.index, result.destination.index);
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <p className="text-[13px] text-brand-text-muted mb-4">{labels.hint}</p>
      {error ? <p className="mesa-alert-danger text-sm px-4 py-2 mb-4">{error}</p> : null}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="table-group-member-reorder" isDropDisabled={!canReorder || busy}>
          {(droppableProvided) => (
            <div
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
              className="max-h-[min(24rem,60vh)] overflow-y-auto rounded-lg border border-brand-border divide-y divide-brand-border/60"
            >
              {tables.map((table, index) => {
                const dragDisabled = !canReorder || busy;
                return (
                  <Draggable
                    key={table.id}
                    draggableId={table.id}
                    index={index}
                    isDragDisabled={dragDisabled}
                  >
                    {(draggableProvided, snapshot) => (
                      <div
                        ref={draggableProvided.innerRef}
                        {...draggableProvided.draggableProps}
                        className={`flex items-center gap-3 px-4 py-2.5 bg-brand-card ${
                          snapshot.isDragging ? 'shadow-lg ring-1 ring-brand-gold/40 z-10' : ''
                        }`}
                        style={draggableProvided.draggableProps.style}
                      >
                        {canReorder ? (
                          <SortOrderDragHandle
                            label={labels.hint}
                            disabled={busy}
                            dragHandleProps={draggableProvided.dragHandleProps}
                          />
                        ) : null}
                        <span className="text-sm text-brand-text font-medium tabular-nums">
                          {table.display_name}
                        </span>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {droppableProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <div className="mt-5 flex justify-end">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {labels.close}
        </Button>
      </div>
    </Modal>
  );
}
