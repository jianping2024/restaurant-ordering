'use client';

import { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { MenuItemListThumb } from '@/components/dashboard/MenuItemListThumb';
import { SortOrderDragHandle } from '@/components/dashboard/SortOrderDragHandle';
import type { MenuCategory, MenuItem } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  filterRecommendedPickerItems,
  getMenuCategoryLabel,
} from '@/lib/menu-admin';
import { formatMenuCatalogItemLabel } from '@/lib/menu-item-display';
import { MENU_RECOMMENDED_ITEMS_MAX } from '@/lib/menu-recommended';
import {
  addRecommendedMenuItemsClient,
  mapRecommendedMenuApiError,
  removeRecommendedMenuItemClient,
  reorderRecommendedMenuItemsClient,
} from '@/lib/dashboard-menu-client';
import { moveIdInOrderedList } from '@/lib/sort-order';

type Props = {
  items: MenuItem[];
  categories: MenuCategory[];
  recommendedItemIds: string[];
  onRecommendedItemIdsChange: (ids: string[]) => void;
};

export function RecommendedMenuItemsManager({
  items,
  categories,
  recommendedItemIds,
  onRecommendedItemIdsChange,
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).menuManager;
  const [error, setError] = useState('');
  const [reorderBusy, setReorderBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategoryId, setPickerCategoryId] = useState('');
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const orderedIds = recommendedItemIds;

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const recommendedItems = useMemo(
    () => orderedIds.map((id) => itemsById.get(id)).filter((row): row is MenuItem => Boolean(row)),
    [orderedIds, itemsById],
  );
  const recommendedIdSet = useMemo(() => new Set(orderedIds), [orderedIds]);
  const atLimit = orderedIds.length >= MENU_RECOMMENDED_ITEMS_MAX;
  const slotsLeft = MENU_RECOMMENDED_ITEMS_MAX - orderedIds.length;
  const pendingSet = useMemo(() => new Set(pendingIds), [pendingIds]);
  const canCheckMore = pendingIds.length < slotsLeft;

  const topCategories = useMemo(
    () =>
      categories
        .filter((c) => !c.parent_id && c.active)
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );

  const errorLabels = {
    saveFail: t.saveFail,
    recommendedAlready: t.recommendedAlready,
    recommendedMax: t.recommendedMax.replace('{max}', String(MENU_RECOMMENDED_ITEMS_MAX)),
    recommendedMissing: t.recommendedMissing,
    dishReorderScopeMismatch: t.dishReorderScopeMismatch,
  };

  const pickerRows = useMemo(
    () =>
      filterRecommendedPickerItems(
        items,
        categories,
        pickerCategoryId || null,
        pickerSearch,
      ),
    [items, categories, pickerCategoryId, pickerSearch],
  );

  const applyIds = (next: string[]) => {
    onRecommendedItemIdsChange(next);
  };

  const resetPicker = () => {
    setPickerOpen(false);
    setPickerSearch('');
    setPickerCategoryId('');
    setPendingIds([]);
  };

  const togglePending = (menuItemId: string) => {
    if (recommendedIdSet.has(menuItemId) || saving) return;
    if (pendingSet.has(menuItemId)) {
      setPendingIds((prev) => prev.filter((id) => id !== menuItemId));
      return;
    }
    if (!canCheckMore) return;
    setPendingIds((prev) => [...prev, menuItemId]);
  };

  const addPending = async () => {
    if (pendingIds.length === 0 || saving) return;
    setSaving(true);
    setError('');
    const result = await addRecommendedMenuItemsClient(pendingIds);
    setSaving(false);
    if (!result.ok) {
      setError(mapRecommendedMenuApiError(result.error, result.message, errorLabels));
      return;
    }
    applyIds(result.data.recommended_item_ids);
    resetPicker();
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
  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
      active
        ? 'border-brand-gold bg-brand-gold text-brand-on-gold'
        : 'border-brand-border bg-brand-card text-brand-text hover:bg-brand-gold/10'
    }`;

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
        onClose={resetPicker}
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
          {topCategories.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
              <button
                type="button"
                className={chipClass(pickerCategoryId === '')}
                onClick={() => setPickerCategoryId('')}
              >
                {t.recommendedPickerAll}
              </button>
              {topCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={chipClass(pickerCategoryId === category.id)}
                  onClick={() => setPickerCategoryId(category.id)}
                >
                  {getMenuCategoryLabel(category, lang)}
                </button>
              ))}
            </div>
          ) : null}
          {pickerRows.length === 0 ? (
            <p className="text-sm text-brand-text-muted py-6 text-center">{t.emptySearch}</p>
          ) : (
            <ul className="max-h-[min(50vh,24rem)] overflow-y-auto divide-y divide-brand-border rounded-xl border border-brand-border">
              {pickerRows.map((row) => {
                const already = recommendedIdSet.has(row.id);
                const pending = pendingSet.has(row.id);
                const checked = already || pending;
                const lockedOut = !already && !pending && !canCheckMore;
                return (
                  <li key={row.id}>
                    <label
                      className={`flex items-center gap-3 px-3 py-2.5 ${
                        already || lockedOut || saving
                          ? 'opacity-60'
                          : 'cursor-pointer hover:bg-brand-gold/10'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="shrink-0"
                        checked={checked}
                        disabled={already || lockedOut || saving}
                        onChange={() => togglePending(row.id)}
                      />
                      <MenuItemListThumb item={row} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-brand-text truncate">
                          {formatMenuCatalogItemLabel(row, lang)}
                        </span>
                        {already ? (
                          <span className="block text-[12px] text-brand-text-muted mt-0.5">
                            {t.recommendedPickerAlready}
                          </span>
                        ) : !row.available ? (
                          <span className="block text-[12px] text-brand-text-muted mt-0.5">
                            {t.unavailableBadge}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex items-center justify-end gap-3 pt-1">
            <p className="mr-auto text-[12px] text-brand-text-muted">
              {t.recommendedPickerSlots
                .replace('{selected}', String(pendingIds.length))
                .replace('{max}', String(slotsLeft))}
            </p>
            <Button
              type="button"
              onClick={() => void addPending()}
              disabled={pendingIds.length === 0}
              loading={saving}
            >
              {t.recommendedPickerConfirm.replace('{count}', String(pendingIds.length))}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
