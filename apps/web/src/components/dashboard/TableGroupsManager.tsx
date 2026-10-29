'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ModalConfirmActions } from '@/components/ui/ModalConfirmActions';
import { SortOrderDragHandle } from '@/components/dashboard/SortOrderDragHandle';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  createTableGroupClient,
  deleteTableGroupClient,
  mapTableGroupApiError,
  reorderTableGroupsClient,
  updateTableGroupClient,
} from '@/lib/dashboard-table-groups-client';
import {
  buildTableGroupIdByTableId,
  buildTableGroupNameByTableId,
  formatGroupMemberTablePreview,
  groupTableIdsByGroupId,
  isValidTableGroupName,
  listGroupMemberTablesInOrder,
  normalizeTableGroupName,
  sortTableGroups,
  sortTablesForGroupAssignPicker,
  TABLE_GROUP_REMARKS_MAX_LEN,
  type RestaurantTableGroup,
  type RestaurantTableGroupMember,
} from '@/lib/restaurant-table-groups';
import { applyOrderedSortOrders, moveIdInOrderedList } from '@/lib/sort-order';
import { sortRestaurantTables, type RestaurantTableRow } from '@/lib/restaurant-tables';

type GroupForm = {
  name: string;
  remarks: string;
  tableIds: string[];
  isTakeaway: boolean;
};

const defaultForm = (): GroupForm => ({
  name: '',
  remarks: '',
  tableIds: [],
  isTakeaway: false,
});

interface Props {
  tables: RestaurantTableRow[];
  initialGroups: RestaurantTableGroup[];
  initialMembers: RestaurantTableGroupMember[];
  onGroupsChange: (
    groups: RestaurantTableGroup[],
    members: RestaurantTableGroupMember[],
    tables?: RestaurantTableRow[],
  ) => void;
  /** When set, parent renders the primary add action in the page toolbar. */
  onRegisterOpenCreate?: (openCreate: () => void) => void;
  hideAddButton?: boolean;
  /** restaurants.feature_flags.takeaway_ordering */
  takeawayOrderingEnabled?: boolean;
}

export function TableGroupsManager({
  tables,
  initialGroups,
  initialMembers,
  onGroupsChange,
  onRegisterOpenCreate,
  hideAddButton = false,
  takeawayOrderingEnabled = false,
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).tableGroups;
  const tm = getMessages(lang).menuManager;

  const [groups, setGroups] = useState<RestaurantTableGroup[]>(() => sortTableGroups(initialGroups));
  const [members, setMembers] = useState<RestaurantTableGroupMember[]>(initialMembers);
  const [localTables, setLocalTables] = useState<RestaurantTableRow[]>(tables);
  const [error, setError] = useState('');
  const [groupReorderBusy, setGroupReorderBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RestaurantTableGroup | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantTableGroup | null>(null);
  const [form, setForm] = useState<GroupForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setLocalTables(tables);
  }, [tables]);

  const sortedTables = useMemo(() => sortRestaurantTables(localTables), [localTables]);
  const tableIdsByGroup = useMemo(() => groupTableIdsByGroupId(members), [members]);
  const tableById = useMemo(() => new Map(sortedTables.map((row) => [row.id, row])), [sortedTables]);
  const groupIdByTableId = useMemo(() => buildTableGroupIdByTableId(members), [members]);
  const groupNameByTableId = useMemo(
    () => buildTableGroupNameByTableId(groups, members),
    [groups, members],
  );

  const assignPickerTables = useMemo(
    () => sortTablesForGroupAssignPicker(sortedTables, groups, members, editing?.id ?? null),
    [sortedTables, groups, members, editing?.id],
  );

  const selectedFormTables = useMemo(
    () =>
      form.tableIds
        .map((id) => tableById.get(id))
        .filter((row): row is RestaurantTableRow => !!row),
    [form.tableIds, tableById],
  );

  const canReorderGroups = groups.length >= 2;
  const canReorderSelected = selectedFormTables.length >= 2;

  const assignStatusLabel = (tableId: string) => {
    const groupId = groupIdByTableId[tableId];
    if (!groupId) return t.assignUngrouped;
    if (editing?.id === groupId) return t.assignInThisGroup;
    const name = groupNameByTableId[tableId];
    return name ? t.assignInGroup.replace('{name}', name) : t.assignUngrouped;
  };

  const publish = (
    nextGroups: RestaurantTableGroup[],
    nextMembers: RestaurantTableGroupMember[],
    nextTables?: RestaurantTableRow[],
  ) => {
    const sorted = sortTableGroups(nextGroups);
    setGroups(sorted);
    setMembers(nextMembers);
    if (nextTables) setLocalTables(nextTables);
    onGroupsChange(sorted, nextMembers, nextTables);
  };

  const memberPreviewForGroup = (groupId: string) =>
    formatGroupMemberTablePreview(tableIdsByGroup[groupId] || [], sortedTables);

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(defaultForm());
    setFormError('');
    setModalOpen(true);
  }, []);

  useEffect(() => {
    onRegisterOpenCreate?.(openCreate);
  }, [onRegisterOpenCreate, openCreate]);

  const existingTakeawayGroup = useMemo(
    () => groups.find((g) => g.is_takeaway) ?? null,
    [groups],
  );

  const openEdit = (group: RestaurantTableGroup) => {
    setEditing(group);
    setForm({
      name: group.name,
      remarks: group.remarks || '',
      tableIds: listGroupMemberTablesInOrder(tableIdsByGroup[group.id] || [], sortedTables).map(
        (row) => row.id,
      ),
      isTakeaway: group.is_takeaway === true,
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm(defaultForm());
    setFormError('');
  };

  const toggleTable = (tableId: string) => {
    setForm((prev) => ({
      ...prev,
      tableIds: prev.tableIds.includes(tableId)
        ? prev.tableIds.filter((id) => id !== tableId)
        : [...prev.tableIds, tableId],
    }));
  };

  const removeSelectedTable = (tableId: string) => {
    setForm((prev) => ({
      ...prev,
      tableIds: prev.tableIds.filter((id) => id !== tableId),
    }));
  };

  const onSelectedDragEnd = (result: DropResult) => {
    if (!canReorderSelected || saving) return;
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    setForm((prev) => {
      const next = moveIdInOrderedList(prev.tableIds, result.source.index, result.destination!.index);
      return next ? { ...prev, tableIds: next } : prev;
    });
  };

  const saveGroup = async () => {
    const name = normalizeTableGroupName(form.name);
    if (!isValidTableGroupName(name)) {
      setFormError(t.invalidName);
      return;
    }
    const remarks = form.remarks.trim().slice(0, TABLE_GROUP_REMARKS_MAX_LEN) || null;
    const tableIds = form.tableIds.filter((id) => tableById.has(id));

    setSaving(true);
    setFormError('');
    setError('');
    try {
      const payload = {
        name,
        remarks,
        table_ids: tableIds,
        is_takeaway: takeawayOrderingEnabled ? form.isTakeaway : false,
      };
      const result = editing
        ? await updateTableGroupClient({ group_id: editing.id, ...payload })
        : await createTableGroupClient(payload);
      if (!result.ok) {
        setFormError(mapTableGroupApiError(result.error, result.message, t));
        return;
      }
      publish(result.data.groups, result.data.members, result.data.tables);
      setModalOpen(false);
      setEditing(null);
      setForm(defaultForm());
      setFormError('');
    } catch {
      setFormError(t.saveFail);
    } finally {
      setSaving(false);
    }
  };

  const commitGroupReorder = async (fromIndex: number, toIndex: number) => {
    const orderedIds = moveIdInOrderedList(
      groups.map((row) => row.id),
      fromIndex,
      toIndex,
    );
    if (!orderedIds || groupReorderBusy) return;

    const previousGroups = groups;
    const previousMembers = members;
    setError('');
    setGroups(sortTableGroups(applyOrderedSortOrders(groups, orderedIds)));
    setGroupReorderBusy(true);
    const result = await reorderTableGroupsClient(orderedIds);
    setGroupReorderBusy(false);
    if (!result.ok) {
      setGroups(previousGroups);
      setMembers(previousMembers);
      setError(mapTableGroupApiError(result.error, result.message, t));
      return;
    }
    publish(result.data.groups, result.data.members);
  };

  const onGroupDragEnd = (result: DropResult) => {
    if (!canReorderGroups || groupReorderBusy) return;
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    void commitGroupReorder(result.source.index, result.destination.index);
  };

  const runDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError('');
    const result = await deleteTableGroupClient(deleteTarget.id);
    setDeleteLoading(false);
    if (!result.ok) {
      setError(mapTableGroupApiError(result.error, result.message, t));
      return;
    }
    publish(result.data.groups, result.data.members);
    setDeleteTarget(null);
  };

  return (
    <div>
      {error ? <p className="mesa-alert-danger text-sm px-4 py-2 mb-4">{error}</p> : null}

      {!hideAddButton ? (
        <div className="mb-4 flex justify-end">
          <Button type="button" onClick={openCreate} className="w-full sm:w-auto">
            + {t.add}
          </Button>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-10 text-center">
          <p className="text-brand-text-muted text-sm mb-4">{t.empty}</p>
          <Button type="button" onClick={openCreate}>
            {t.emptyCta}
          </Button>
        </div>
      ) : (
        <>
          <DragDropContext onDragEnd={onGroupDragEnd}>
            <Droppable droppableId="table-group-reorder" isDropDisabled={!canReorderGroups || groupReorderBusy}>
              {(droppableProvided) => (
                <div
                  ref={droppableProvided.innerRef}
                  {...droppableProvided.droppableProps}
                  className="rounded-xl border border-brand-border bg-brand-card overflow-hidden divide-y divide-brand-border/70"
                >
                  {groups.map((row, index) => {
                    const preview = memberPreviewForGroup(row.id);
                    const dragDisabled = !canReorderGroups || groupReorderBusy;
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
                            className={`px-3 py-2.5 sm:px-4 flex items-start gap-2.5 transition-shadow ${
                              snapshot.isDragging ? 'shadow-lg ring-1 ring-brand-gold/40 z-10 bg-brand-card' : ''
                            }`}
                            style={draggableProvided.draggableProps.style}
                          >
                            {canReorderGroups ? (
                              <SortOrderDragHandle
                                label={t.sortOrderHint}
                                disabled={groupReorderBusy}
                                dragHandleProps={draggableProvided.dragHandleProps}
                              />
                            ) : null}
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <p className="font-medium text-brand-text flex items-center gap-1.5 min-w-0">
                                  {takeawayOrderingEnabled && row.is_takeaway ? (
                                    <span
                                      aria-hidden
                                      className="text-brand-gold shrink-0"
                                      title={t.takeawayGroupBadge}
                                    >
                                      🥡
                                    </span>
                                  ) : null}
                                  <span className="truncate">{row.name}</span>
                                </p>
                                {takeawayOrderingEnabled && row.is_takeaway ? (
                                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-900">
                                    {t.takeawayGroupBadge}
                                  </span>
                                ) : null}
                                <span className="inline-flex rounded-full border border-brand-border/70 bg-brand-bg/80 px-1.5 py-0.5 text-[11px] text-brand-text-muted tabular-nums">
                                  {t.tablesSummary.replace('{count}', String(preview.totalCount))}
                                </span>
                              </div>
                              {preview.totalCount === 0 ? (
                                <span className="text-[13px] text-brand-text-muted">{t.tablesEmpty}</span>
                              ) : (
                                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                  {preview.chips.map((chip) => (
                                    <span
                                      key={chip.id}
                                      className="inline-flex rounded-md border border-brand-border/70 bg-brand-bg/80 px-1.5 py-0.5 text-[11px] text-brand-text tabular-nums"
                                    >
                                      {chip.display_name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                              <button
                                type="button"
                                onClick={() => openEdit(row)}
                                className="text-brand-text-muted hover:text-brand-gold text-sm px-2 py-1"
                              >
                                {tm.edit}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(row)}
                                className="mesa-text-danger hover:opacity-90 text-sm px-2 py-1"
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
          {canReorderGroups ? (
            <p className="text-[12px] text-brand-text-muted mt-2 px-1">{t.sortOrderHint}</p>
          ) : null}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? t.modalEdit : t.modalAdd}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="text-[13px] text-brand-text-muted mb-1.5 block">{t.nameLabel}</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              maxLength={32}
            />
          </div>
          <div>
            <label className="text-[13px] text-brand-text-muted mb-1.5 block">{t.remarksLabel}</label>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
              maxLength={TABLE_GROUP_REMARKS_MAX_LEN}
              rows={2}
              className="w-full rounded-lg border border-brand-border bg-brand-card px-4 py-2.5 text-base text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            />
          </div>
          {takeawayOrderingEnabled ? (
            <label
              className={`flex items-start gap-3 rounded-lg border border-brand-border px-3 py-3 ${
                existingTakeawayGroup && existingTakeawayGroup.id !== editing?.id
                  ? 'opacity-60'
                  : ''
              }`}
            >
              <input
                type="checkbox"
                checked={form.isTakeaway}
                disabled={
                  Boolean(existingTakeawayGroup && existingTakeawayGroup.id !== editing?.id)
                }
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isTakeaway: e.target.checked }))
                }
                className="mt-0.5 rounded border-brand-border text-brand-gold focus:ring-brand-gold/40"
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-brand-text">
                  {t.takeawayGroupToggle}
                </span>
                <span className="block text-[13px] text-brand-text-muted mt-0.5">
                  {existingTakeawayGroup && existingTakeawayGroup.id !== editing?.id
                    ? t.takeawayGroupExists.replace('{name}', existingTakeawayGroup.name)
                    : t.takeawayGroupHint}
                </span>
              </span>
            </label>
          ) : null}

          <div>
            <p className="text-[13px] font-medium text-brand-text mb-1">{t.selectedTablesTitle}</p>
            <p className="text-[12px] text-brand-text-muted mb-2">{t.selectedTablesHint}</p>
            {selectedFormTables.length === 0 ? (
              <p className="rounded-lg border border-dashed border-brand-border px-4 py-3 text-sm text-brand-text-muted">
                {t.tablesEmpty}
              </p>
            ) : (
              <DragDropContext onDragEnd={onSelectedDragEnd}>
                <Droppable
                  droppableId="table-group-selected-reorder"
                  isDropDisabled={!canReorderSelected || saving}
                >
                  {(droppableProvided) => (
                    <div
                      ref={droppableProvided.innerRef}
                      {...droppableProvided.droppableProps}
                      className="max-h-48 overflow-y-auto rounded-lg border border-brand-border divide-y divide-brand-border/60"
                    >
                      {selectedFormTables.map((table, index) => {
                        const dragDisabled = !canReorderSelected || saving;
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
                                className={`flex items-center gap-2 px-3 py-2 bg-brand-card ${
                                  snapshot.isDragging
                                    ? 'shadow-lg ring-1 ring-brand-gold/40 z-10'
                                    : ''
                                }`}
                                style={draggableProvided.draggableProps.style}
                              >
                                {canReorderSelected ? (
                                  <SortOrderDragHandle
                                    label={t.selectedTablesHint}
                                    disabled={saving}
                                    dragHandleProps={draggableProvided.dragHandleProps}
                                  />
                                ) : null}
                                <span className="text-sm text-brand-text font-medium tabular-nums flex-1 min-w-0 truncate">
                                  {table.display_name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeSelectedTable(table.id)}
                                  disabled={saving}
                                  className="text-brand-text-muted hover:mesa-text-danger text-sm px-1.5 py-0.5 shrink-0"
                                  aria-label={tm.remove}
                                >
                                  ×
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
            )}
          </div>

          <div>
            <p className="text-[13px] text-brand-text-muted mb-2">{t.assignTablesPool}</p>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-brand-border divide-y divide-brand-border/60">
              {assignPickerTables.length === 0 ? (
                <p className="px-4 py-3 text-sm text-brand-text-muted">{t.noTables}</p>
              ) : (
                assignPickerTables.map((table) => {
                  const checked = form.tableIds.includes(table.id);
                  const currentGroupId = groupIdByTableId[table.id];
                  const otherGroupName =
                    checked && currentGroupId && currentGroupId !== editing?.id
                      ? groupNameByTableId[table.id]
                      : null;
                  return (
                    <label
                      key={table.id}
                      className="flex items-start gap-3 px-4 py-2.5 text-sm cursor-pointer hover:bg-brand-bg/60"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTable(table.id)}
                        className="rounded border-brand-border mt-0.5 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-brand-text font-medium">{table.display_name}</span>
                        <span className="text-[12px] text-brand-text-muted block mt-0.5">
                          {assignStatusLabel(table.id)}
                        </span>
                        {otherGroupName ? (
                          <span className="text-[11px] text-amber-800/90 block mt-1">
                            {t.assignMoveHint.replace('{name}', otherGroupName)}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
          {formError ? <p className="text-sm mesa-text-danger">{formError}</p> : null}
          <ModalConfirmActions
            cancelLabel={tm.cancel}
            confirmLabel={editing ? tm.save : t.submitAdd}
            onCancel={closeModal}
            onConfirm={() => void saveGroup()}
            busy={saving}
          />
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t.confirmDeleteTitle} size="sm">
        <p className="text-[13px] text-brand-text-muted mb-4">
          {deleteTarget ? t.confirmDeleteBody.replace('{name}', deleteTarget.name) : ''}
        </p>
        <ModalConfirmActions
          className="mt-5"
          cancelLabel={tm.cancel}
          confirmLabel={tm.remove}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void runDelete()}
          busy={deleteLoading}
          confirmVariant="danger"
        />
      </Modal>
    </div>
  );
}
