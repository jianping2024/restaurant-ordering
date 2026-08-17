'use client';

import { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { MenuItemListThumb } from '@/components/dashboard/MenuItemListThumb';
import { SortOrderDragHandle } from '@/components/dashboard/SortOrderDragHandle';
import type { MenuItem } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { itemMatchesSearch } from '@/lib/menu-admin';
import { formatMenuCatalogItemLabel } from '@/lib/menu-item-display';
import { MENU_RECOMMENDED_ITEMS_MAX } from '@/lib/menu-recommended';
import {
  addRecommendedMenuItemClient,
  mapRecommendedMenuApiError,
  removeRecommendedMenuItemClient,
  reorderRecommendedMenuItemsClient,
} from '@/lib/dashboard-menu-client';
import { moveIdInOrderedList } from '@/lib/sort-order';

type Props = {
  items: MenuItem[];
  recommendedItemIds: string[];
  onRecommendedItemIdsChange: (ids: string[]) => void;
};

export function RecommendedMenuItemsManager({
  items,
  recommendedItemIds,
  onRecommendedItemIdsChange,
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).menuManager;
  const [error, setError] = useState('');
  const [reorderBusy, setReorderBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const orderedIds = recommendedItemIds;

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const recommendedItems = useMemo(
    () => orderedIds.map((id) => itemsById.get(id)).filter((row): row is MenuItem => Boolean(row)),
    [orderedIds, itemsById],
  );
  const recommendedIdSet = useMemo(() => new Set(orderedIds), [orderedIds]);
  const atLimit = orderedIds.length >= MENU_RECOMMENDED_ITEMS_MAX;

  const errorLabels = {
    saveFail: t.saveFail,
    recommendedAlready: t.recommendedAlready,
    recommendedMax: t.recommendedMax.replace('{max}', String(MENU_RECOMMENDED_ITEMS_MAX)),
    recommendedMissing: t.recommendedMissing,
    dishReorderScopeMismatch: t.dishReorderScopeMismatch,
  };

  const pickerCandidates = useMemo(
    () =>
      items
        .filter((item) => !recommendedIdSet.has(item.id))
        .filter((item) => itemMatchesSearch(item, pickerSearch)),
    [items, recommendedIdSet, pickerSearch],
  );

  const applyIds = (next: string[]) => {
    onRecommendedItemIdsChange(next);
  };

  const addItem = async (menuItemId: string) => {
    setSavingId(menuItemId);
    setError('');
    const result = await addRecommendedMenuItemClient(menuItemId);
    setSavingId(null);
    if (!result.ok) {
      setError(mapRecommendedMenuApiError(result.error, result.message, errorLabels));
      return;
    }
    applyIds(result.data.recommended_item_ids);
    setPickerOpen(false);
    setPickerSearch('');
  };

  const removeItem = async (menuItemId: string) => {
    setSavingId(menuItemId);
    setError('');
    const result = await removeRecommendedMenuItemClient(menuItemId);
    setSavingId(null);
    if (!result.ok) {
      setError(mapRecommendedMenuApiError(result.error, result.message, errorLabels));
      return;
    }
    applyIds(result.data.recommended_item_ids);
  };

  const commitReorder = async (fromIndex: number, toIndex: number) => {
    const next = moveIdInOrderedList(orderedIds, fromIndex, toIndex);
    if (!next) return;
    const previous = orderedIds;
    onRecommendedItemIdsChange(next);
    setReorderBusy(true);
    setError('');
    const result = await reorderRecommendedMenuItemsClient(next);
    setReorderBusy(false);
    if (!result.ok) {
      onRecommendedItemIdsChange(previous);
      setError(mapRecommendedMenuApiError(result.error, result.message, errorLabels));
      return;
    }
    applyIds(result.data.recommended_item_ids);
  };

  const onDragEnd = (result: DropResult) => {
    if (reorderBusy) return;
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    void commitReorder(result.source.index, result.destination.index);
  };

  const canReorder = recommendedItems.length > 1;

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <p className="text-[13px] text-brand-text-muted mb-4">
        {t.recommendedHint.replace('{max}', String(MENU_RECOMMENDED_ITEMS_MAX))}
      </p>
      {error ? <p className="mesa-alert-danger text-sm px-4 py-2 mb-4">{error}</p> : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={atLimit}
          className="w-full sm:w-auto shrink-0"
        >
          + {t.addRecommended}
        </Button>
      </div>
      {atLimit ? (
        <p className="text-[12px] text-brand-text-muted mb-3">
          {t.recommendedMax.replace('{max}', String(MENU_RECOMMENDED_ITEMS_MAX))}
        </p>
      ) : null}

      {recommendedItems.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-10 sm:p-12 text-center">
          <p className="text-brand-text-muted text-sm mb-4">{t.recommendedEmpty}</p>
          <Button type="button" onClick={() => setPickerOpen(true)} disabled={items.length === 0}>
            {t.recommendedEmptyCta}
          </Button>
        </div>
      ) : (
        <>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="menu-recommended-reorder" isDropDisabled={!canReorder || reorderBusy}>
              {(droppableProvided) => (
                <div
                  ref={droppableProvided.innerRef}
                  {...droppableProvided.droppableProps}
                  className="space-y-2"
                >
                  {recommendedItems.map((row, index) => {
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
                                label={t.recommendedSortHint}
                                disabled={reorderBusy}
                                dragHandleProps={draggableProvided.dragHandleProps}
                              />
                            ) : null}
                            <MenuItemListThumb item={row} />
                            <div className="min-w-0 flex-1">
                              <p className="text-brand-text font-medium truncate">
                                {formatMenuCatalogItemLabel(row, lang)}
                              </p>
                              {!row.available ? (
                                <p className="text-[12px] text-brand-text-muted mt-0.5">
                                  {t.unavailableBadge}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              disabled={savingId === row.id}
                              onClick={() => void removeItem(row.id)}
                              className="mesa-text-danger hover:opacity-90 transition-colors text-sm px-2 py-1 shrink-0"
                            >
                              {t.remove}
                            </button>
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
            <p className="text-[12px] text-brand-text-muted mt-2 px-1">{t.recommendedSortHint}</p>
          ) : null}
        </>
      )}

      <Modal
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickerSearch('');
        }}
        title={t.recommendedPickerTitle}
        size="lg"
      >
        <div className="space-y-3">
          <input
            type="search"
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full h-11 rounded-lg border border-brand-border bg-brand-card px-4 text-base text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
          />
          {pickerCandidates.length === 0 ? (
            <p className="text-sm text-brand-text-muted py-6 text-center">{t.emptySearch}</p>
          ) : (
            <ul className="max-h-[min(50vh,24rem)] overflow-y-auto divide-y divide-brand-border rounded-xl border border-brand-border">
              {pickerCandidates.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={savingId === row.id || atLimit}
                    onClick={() => void addItem(row.id)}
                    className="w-full text-left px-3 py-2.5 hover:bg-brand-gold/10 transition-colors disabled:opacity-50 flex items-center gap-3"
                  >
                    <MenuItemListThumb item={row} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-brand-text truncate">
                        {formatMenuCatalogItemLabel(row, lang)}
                      </span>
                      {!row.available ? (
                        <span className="block text-[12px] text-brand-text-muted mt-0.5">
                          {t.unavailableBadge}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  );
}
