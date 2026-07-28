'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DishSortOrderButtons } from '@/components/dashboard/DishSortOrderButtons';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { TableGroupMemberOrderModal } from '@/components/dashboard/TableGroupMemberOrderModal';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  createTableGroupClient,
  deleteTableGroupClient,
  mapTableGroupApiError,
  moveTableGroupMemberOrderClient,
  moveTableGroupOrderClient,
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
import { sortRestaurantTables, type RestaurantTableRow } from '@/lib/restaurant-tables';

type GroupForm = {
  name: string;
  remarks: string;
  tableIds: string[];
};

const defaultForm = (): GroupForm => ({ name: '', remarks: '', tableIds: [] });

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
}

export function TableGroupsManager({
  tables,
  initialGroups,
  initialMembers,
  onGroupsChange,
  onRegisterOpenCreate,
  hideAddButton = false,
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).tableGroups;
  const tm = getMessages(lang).menuManager;

  const [groups, setGroups] = useState<RestaurantTableGroup[]>(() => sortTableGroups(initialGroups));
  const [members, setMembers] = useState<RestaurantTableGroupMember[]>(initialMembers);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RestaurantTableGroup | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantTableGroup | null>(null);
  const [form, setForm] = useState<GroupForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [orderTarget, setOrderTarget] = useState<RestaurantTableGroup | null>(null);
  const [orderError, setOrderError] = useState('');

  const sortedTables = useMemo(() => sortRestaurantTables(tables), [tables]);
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

  const orderTargetTables = useMemo(() => {
    if (!orderTarget) return [];
    return listGroupMemberTablesInOrder(tableIdsByGroup[orderTarget.id] || [], sortedTables);
  }, [orderTarget, sortedTables, tableIdsByGroup]);

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

  const openEdit = (group: RestaurantTableGroup) => {
    setEditing(group);
    setForm({
      name: group.name,
      remarks: group.remarks || '',
      tableIds: [...(tableIdsByGroup[group.id] || [])],
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(defaultForm());
    setFormError('');
  };

  const openMemberOrder = (group: RestaurantTableGroup) => {
    setOrderError('');
    setOrderTarget(group);
  };

  const closeMemberOrder = () => {
    setOrderTarget(null);
    setOrderError('');
  };

  const toggleTable = (tableId: string) => {
    setForm((prev) => ({
      ...prev,
      tableIds: prev.tableIds.includes(tableId)
        ? prev.tableIds.filter((id) => id !== tableId)
        : [...prev.tableIds, tableId],
    }));
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
      };
      const result = editing
        ? await updateTableGroupClient({ group_id: editing.id, ...payload })
        : await createTableGroupClient(payload);
      if (!result.ok) {
        setFormError(mapTableGroupApiError(result.error, result.message, t));
        return;
      }
      publish(result.data.groups, result.data.members);
      closeModal();
    } catch {
      setFormError(t.saveFail);
    } finally {
      setSaving(false);
    }
  };

  const moveRow = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= groups.length) return;
    const a = groups[index];
    setError('');
    const result = await moveTableGroupOrderClient(a.id, dir);
    if (!result.ok) {
      setError(mapTableGroupApiError(result.error, result.message, t));
      return;
    }
    publish(result.data.groups, result.data.members);
  };

  const moveMemberRow = async (groupId: string, tableId: string, dir: -1 | 1) => {
    setOrderError('');
    const result = await moveTableGroupMemberOrderClient(groupId, tableId, dir);
    if (!result.ok) {
      setOrderError(mapTableGroupApiError(result.error, result.message, t));
      return;
    }
    publish(result.data.groups, result.data.members, result.data.tables);
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
    if (orderTarget?.id === deleteTarget.id) {
      closeMemberOrder();
    }
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
        <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-left text-brand-text-muted">
                <th className="px-4 py-3 font-medium">{t.colName}</th>
                <th className="hidden md:table-cell px-4 py-3 font-medium">{t.colRemarks}</th>
                <th className="px-4 py-3 font-medium">{t.colTables}</th>
                <th className="px-4 py-3 font-medium text-right w-[14rem]">{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((row, index) => {
                const preview = memberPreviewForGroup(row.id);
                const canReorder = preview.totalCount >= 2;
                return (
                  <tr key={row.id} className="border-b border-brand-border/80 last:border-0">
                    <td className="px-4 py-3 font-medium text-brand-text">{row.name}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-brand-text-muted max-w-[12rem] truncate">
                      {row.remarks || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {preview.totalCount === 0 ? (
                        <span className="text-[13px] text-brand-text-muted">{t.tablesEmpty}</span>
                      ) : (
                        <div className="space-y-1.5">
                          <span className="text-[12px] text-brand-text-muted">
                            {t.tablesSummary.replace('{count}', String(preview.totalCount))}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {preview.chips.map((chip) => (
                              <span
                                key={chip.id}
                                className="inline-flex rounded-md border border-brand-border/70 bg-brand-bg/80 px-1.5 py-0.5 text-[11px] text-brand-text tabular-nums"
                              >
                                {chip.display_name}
                              </span>
                            ))}
                            {preview.overflowCount > 0 ? (
                              <span className="inline-flex rounded-md border border-brand-border/70 bg-brand-bg/80 px-1.5 py-0.5 text-[11px] text-brand-text-muted tabular-nums">
                                {t.tablesOverflow.replace('{count}', String(preview.overflowCount))}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <DishSortOrderButtons
                          index={index}
                          length={groups.length}
                          moveUpLabel={t.moveUp}
                          moveDownLabel={t.moveDown}
                          onMove={(dir) => void moveRow(index, dir)}
                        />
                        {canReorder ? (
                          <button
                            type="button"
                            onClick={() => openMemberOrder(row)}
                            className="text-brand-text-muted hover:text-brand-gold text-sm px-2 py-1 whitespace-nowrap"
                          >
                            {t.reorderMembers}
                          </button>
                        ) : null}
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TableGroupMemberOrderModal
        open={!!orderTarget}
        group={orderTarget}
        tables={orderTargetTables}
        error={orderError}
        labels={{
          title: t.reorderMembersTitle,
          hint: t.reorderMembersHint,
          moveUp: t.memberMoveUp,
          moveDown: t.memberMoveDown,
          close: tm.cancel,
        }}
        onClose={closeMemberOrder}
        onMove={(tableId, dir) => {
          if (!orderTarget) return;
          void moveMemberRow(orderTarget.id, tableId, dir);
        }}
      />

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
              rows={3}
              className="w-full rounded-lg border border-brand-border bg-brand-card px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            />
          </div>
          <div>
            <p className="text-[13px] text-brand-text-muted mb-2">{t.assignTables}</p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-brand-border divide-y divide-brand-border/60">
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
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
            <Button variant="outline" onClick={closeModal}>
              {tm.cancel}
            </Button>
            <Button loading={saving} onClick={() => void saveGroup()}>
              {editing ? tm.save : t.submitAdd}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t.confirmDeleteTitle} size="sm">
        <p className="text-[13px] text-brand-text-muted mb-4">
          {deleteTarget ? t.confirmDeleteBody.replace('{name}', deleteTarget.name) : ''}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            {tm.cancel}
          </Button>
          <Button variant="danger" loading={deleteLoading} onClick={() => void runDelete()}>
            {tm.remove}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
