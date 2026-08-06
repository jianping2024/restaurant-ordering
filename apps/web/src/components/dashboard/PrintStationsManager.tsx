'use client';

import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SortOrderDragHandle } from '@/components/dashboard/SortOrderDragHandle';
import type { MenuCategory, MenuItem, PrintStation } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { countPrintStationBindings, getPrintStationDisplayName } from '@/lib/print-station-admin';
import {
  createPrintStationClient,
  deletePrintStationClient,
  reorderPrintStationsClient,
  updatePrintStationClient,
} from '@/lib/dashboard-menu-client';
import {
  applyOrderedSortOrders,
  compareSortOrderThenCreatedAt,
  moveIdInOrderedList,
} from '@/lib/sort-order';

interface PrintStationsManagerProps {
  restaurantId: string;
  initialStations: PrintStation[];
  initialCategories?: Pick<MenuCategory, 'id' | 'print_station_id'>[];
  initialItems?: Pick<MenuItem, 'id' | 'print_station_id'>[];
  onStationsChange?: (stations: PrintStation[]) => void;
}

type StationForm = {
  name_pt: string;
  name_en: string;
  name_zh: string;
};

const defaultStationForm: StationForm = {
  name_pt: '',
  name_en: '',
  name_zh: '',
};

export function PrintStationsManager({
  initialStations,
  initialCategories = [],
  initialItems = [],
  onStationsChange,
}: PrintStationsManagerProps) {
  const { lang } = useLanguage();
  const t = getMessages(lang).printStations;
  const tm = getMessages(lang).menuManager;

  const [stations, setStations] = useState<PrintStation[]>(() =>
    [...initialStations].sort(compareSortOrderThenCreatedAt),
  );

  useEffect(() => {
    onStationsChange?.(stations);
  }, [stations, onStationsChange]);
  const [error, setError] = useState('');
  const [reorderBusy, setReorderBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PrintStation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<PrintStation | null>(null);
  const [stationForm, setStationForm] = useState<StationForm>(defaultStationForm);
  const [stationSaving, setStationSaving] = useState(false);
  const [stationError, setStationError] = useState('');

  const bindingsForStation = (stationId: string) =>
    countPrintStationBindings(stationId, initialCategories, initialItems);

  const bindingsLabel = (stationId: string) => {
    const { categories, dishes } = bindingsForStation(stationId);
    if (categories === 0 && dishes === 0) return t.bindingsEmpty;
    return t.bindingsSummary.replace('{categories}', String(categories)).replace('{dishes}', String(dishes));
  };

  const deleteTargetBindings = deleteTarget ? bindingsForStation(deleteTarget.id) : null;
  const canReorder = stations.length >= 2;

  const openStationCreateModal = () => {
    setEditingStation(null);
    setStationForm(defaultStationForm);
    setStationError('');
    setStationModalOpen(true);
  };

  const openStationEditModal = (row: PrintStation) => {
    setEditingStation(row);
    setStationForm({
      name_pt: row.name_pt,
      name_en: row.name_en ?? '',
      name_zh: row.name_zh ?? '',
    });
    setStationError('');
    setStationModalOpen(true);
  };

  const resetStationModal = () => {
    setStationModalOpen(false);
    setEditingStation(null);
    setStationForm(defaultStationForm);
    setStationError('');
  };

  const closeStationModal = () => {
    if (stationSaving) return;
    resetStationModal();
  };

  const saveStation = async () => {
    if (!stationForm.name_pt.trim()) {
      setStationError(tm.ptNameRequired);
      return;
    }
    setStationSaving(true);
    setStationError('');
    try {
      const input = {
        name_pt: stationForm.name_pt.trim(),
        name_en: stationForm.name_en.trim() || null,
        name_zh: stationForm.name_zh.trim() || null,
      };
      if (editingStation) {
        const result = await updatePrintStationClient(editingStation.id, input);
        if (!result.ok) throw new Error(result.error);
        setStations((prev) =>
          prev.map((s) => (s.id === editingStation.id ? result.data.station : s)),
        );
      } else {
        const result = await createPrintStationClient(input);
        if (!result.ok) throw new Error(result.error);
        setStations((prev) =>
          [...prev, result.data.station].sort(compareSortOrderThenCreatedAt),
        );
      }
      resetStationModal();
    } catch {
      setStationError(tm.saveFail);
    } finally {
      setStationSaving(false);
    }
  };

  const commitReorder = async (fromIndex: number, toIndex: number) => {
    const orderedIds = moveIdInOrderedList(
      stations.map((row) => row.id),
      fromIndex,
      toIndex,
    );
    if (!orderedIds || reorderBusy) return;

    const previous = stations;
    setError('');
    setStations((prev) =>
      [...applyOrderedSortOrders(prev, orderedIds)].sort(compareSortOrderThenCreatedAt),
    );
    setReorderBusy(true);
    const result = await reorderPrintStationsClient(orderedIds);
    setReorderBusy(false);
    if (!result.ok) {
      setStations(previous);
      setError(t.saveFail);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!canReorder || reorderBusy) return;
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    void commitReorder(result.source.index, result.destination.index);
  };

  const runDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError('');
    const result = await deletePrintStationClient(deleteTarget.id);
    setDeleteLoading(false);
    if (!result.ok) {
      setError(t.deleteFail);
      return;
    }
    setStations((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {error ? (
        <p className="mesa-alert-danger text-sm px-4 py-2 mb-4">{error}</p>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" onClick={openStationCreateModal} className="w-full sm:w-auto shrink-0">
          + {t.add}
        </Button>
      </div>

      {stations.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-10 sm:p-12 text-center">
          <p className="text-brand-text-muted text-sm mb-4">{t.empty}</p>
          <Button type="button" onClick={openStationCreateModal}>
            {t.emptyCta}
          </Button>
        </div>
      ) : (
        <>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="print-station-reorder" isDropDisabled={!canReorder || reorderBusy}>
              {(droppableProvided) => (
                <div
                  ref={droppableProvided.innerRef}
                  {...droppableProvided.droppableProps}
                  className="space-y-2"
                >
                  {stations.map((row, index) => {
                    const dragDisabled = !canReorder || reorderBusy;
                    return (
                      <Draggable
                        key={row.id}
                        draggableId={row.id}
                        index={index}
                        isDragDisabled={dragDisabled}
                      >
                        {(draggableProvided, snapshot) => (
                          <div
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                            className={`bg-brand-card border border-brand-border rounded-xl px-3 py-3 sm:px-4 flex items-center gap-3 transition-shadow ${
                              snapshot.isDragging ? 'shadow-lg ring-1 ring-brand-gold/40 z-10' : ''
                            }`}
                            style={draggableProvided.draggableProps.style}
                          >
                            {canReorder ? (
                              <SortOrderDragHandle
                                label={t.sortOrderHint}
                                disabled={reorderBusy}
                                dragHandleProps={draggableProvided.dragHandleProps}
                              />
                            ) : null}
                            <div className="min-w-0 flex-1">
                              <p className="text-brand-text font-medium">
                                {getPrintStationDisplayName(row, lang)}
                              </p>
                              {row.name_pt !== getPrintStationDisplayName(row, lang) ? (
                                <p className="text-[12px] text-brand-text-muted mt-0.5">
                                  PT: {row.name_pt}
                                </p>
                              ) : null}
                              <p className="text-[12px] text-brand-text-muted mt-0.5">
                                {bindingsLabel(row.id)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openStationEditModal(row)}
                                className="text-brand-text-muted hover:text-brand-gold transition-colors text-sm px-2 py-1"
                              >
                                {tm.edit}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(row)}
                                className="mesa-text-danger hover:opacity-90 transition-colors text-sm px-2 py-1"
                              >
                                {tm.remove}
                              </button>
                            </div>
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
          {canReorder ? (
            <p className="text-[12px] text-brand-text-muted mt-2 px-1">{t.sortOrderHint}</p>
          ) : null}
        </>
      )}

      <Modal
        open={stationModalOpen}
        onClose={closeStationModal}
        title={editingStation ? t.modalEdit : t.modalAdd}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={tm.ptNameReq}
              value={stationForm.name_pt}
              onChange={(e) => setStationForm((f) => ({ ...f, name_pt: e.target.value }))}
              placeholder="Cozinha"
            />
            <Input
              label={tm.enName}
              value={stationForm.name_en}
              onChange={(e) => setStationForm((f) => ({ ...f, name_en: e.target.value }))}
              placeholder="Kitchen"
            />
          </div>
          <Input
            label={tm.zhName}
            value={stationForm.name_zh}
            onChange={(e) => setStationForm((f) => ({ ...f, name_zh: e.target.value }))}
            placeholder="后厨"
          />
          {stationError ? (
            <p className="mesa-alert-danger text-sm px-4 py-2">{stationError}</p>
          ) : null}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button onClick={saveStation} loading={stationSaving} className="flex-1">
              {editingStation ? tm.saveEdit : t.submitAdd}
            </Button>
            <Button variant="outline" onClick={closeStationModal} className="w-full sm:w-auto" disabled={stationSaving}>
              {tm.cancel}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => {
          if (!deleteLoading) setDeleteTarget(null);
        }}
        title={t.confirmDeleteTitle}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-brand-text">
            {deleteTarget && deleteTargetBindings
              ? t.confirmDeleteBody
                  .replace('{categories}', String(deleteTargetBindings.categories))
                  .replace('{dishes}', String(deleteTargetBindings.dishes))
                  .replace('{name}', getPrintStationDisplayName(deleteTarget, lang))
              : t.confirmDeleteBody}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={runDelete} loading={deleteLoading}>
              {t.confirm}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
