'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { isPostgresUniqueViolation } from '@/lib/menu-code-uniqueness';
import {
  buildTableGroupIdByTableId,
  buildTableGroupNameByTableId,
  groupTableIdsByGroupId,
  isValidTableGroupName,
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
  restaurantId: string;
  tables: RestaurantTableRow[];
  initialGroups: RestaurantTableGroup[];
  initialMembers: RestaurantTableGroupMember[];
  onGroupsChange: (groups: RestaurantTableGroup[], members: RestaurantTableGroupMember[]) => void;
}

export function TableGroupsManager({
  restaurantId,
  tables,
  initialGroups,
  initialMembers,
  onGroupsChange,
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).tableGroups;
  const tm = getMessages(lang).menuManager;
  const supabase = createClient();

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

  const assignStatusLabel = (tableId: string) => {
    const groupId = groupIdByTableId[tableId];
    if (!groupId) return t.assignUngrouped;
    if (editing?.id === groupId) return t.assignInThisGroup;
    const name = groupNameByTableId[tableId];
    return name ? t.assignInGroup.replace('{name}', name) : t.assignUngrouped;
  };

  const publish = (nextGroups: RestaurantTableGroup[], nextMembers: RestaurantTableGroupMember[]) => {
    const sorted = sortTableGroups(nextGroups);
    setGroups(sorted);
    setMembers(nextMembers);
    onGroupsChange(sorted, nextMembers);
  };

  const tableLabelsForGroup = (groupId: string) => {
    const ids = tableIdsByGroup[groupId] || [];
    return ids
      .map((id) => tableById.get(id)?.display_name)
      .filter((name): name is string => !!name);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm());
    setFormError('');
    setModalOpen(true);
  };

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
      let groupId = editing?.id;
      if (editing) {
        const { error: upErr } = await supabase
          .from('restaurant_table_groups')
          .update({ name, remarks })
          .eq('id', editing.id);
        if (upErr) throw upErr;
      } else {
        const nextOrder = groups.length === 0 ? 0 : Math.max(...groups.map((g) => g.sort_order)) + 1;
        const { data, error: insErr } = await supabase
          .from('restaurant_table_groups')
          .insert({
            restaurant_id: restaurantId,
            name,
            remarks,
            sort_order: nextOrder,
          })
          .select('id, restaurant_id, name, remarks, sort_order, created_at')
          .single();
        if (insErr) throw insErr;
        if (!data) throw new Error('insert_failed');
        groupId = (data as RestaurantTableGroup).id;
      }

      if (!groupId) throw new Error('missing_group');

      const { error: rpcErr } = await supabase.rpc('replace_table_group_members', {
        p_group_id: groupId,
        p_table_ids: tableIds,
      });
      if (rpcErr) throw rpcErr;

      const [{ data: nextGroups, error: groupsErr }, { data: nextMembers, error: membersErr }] =
        await Promise.all([
          supabase
            .from('restaurant_table_groups')
            .select('id, restaurant_id, name, remarks, sort_order, created_at')
            .eq('restaurant_id', restaurantId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true }),
          supabase
            .from('restaurant_table_group_members')
            .select('group_id, table_id, restaurant_id')
            .eq('restaurant_id', restaurantId),
        ]);
      if (groupsErr) throw groupsErr;
      if (membersErr) throw membersErr;

      publish(
        sortTableGroups((nextGroups || []) as RestaurantTableGroup[]),
        (nextMembers || []) as RestaurantTableGroupMember[],
      );
      closeModal();
    } catch (err) {
      if (isPostgresUniqueViolation(err as { code?: string })) {
        setFormError(t.duplicateName);
      } else {
        setFormError(t.saveFail);
      }
    } finally {
      setSaving(false);
    }
  };

  const moveRow = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= groups.length) return;
    const a = groups[index];
    const b = groups[j];
    setError('');
    const { error: e1 } = await supabase
      .from('restaurant_table_groups')
      .update({ sort_order: b.sort_order })
      .eq('id', a.id);
    if (e1) {
      setError(t.saveFail);
      return;
    }
    const { error: e2 } = await supabase
      .from('restaurant_table_groups')
      .update({ sort_order: a.sort_order })
      .eq('id', b.id);
    if (e2) {
      setError(t.saveFail);
      return;
    }
    const copy = groups.map((g) => ({ ...g }));
    copy[index] = { ...a, sort_order: b.sort_order };
    copy[j] = { ...b, sort_order: a.sort_order };
    publish(sortTableGroups(copy), members);
  };

  const runDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setError('');
    const { error: delErr } = await supabase
      .from('restaurant_table_groups')
      .delete()
      .eq('id', deleteTarget.id);
    setDeleteLoading(false);
    if (delErr) {
      setError(t.deleteFail);
      return;
    }
    const nextGroups = groups.filter((g) => g.id !== deleteTarget.id);
    const nextMembers = members.filter((m) => m.group_id !== deleteTarget.id);
    publish(nextGroups, nextMembers);
    setDeleteTarget(null);
  };

  return (
    <div>
      {error ? <p className="mesa-alert-danger text-sm px-4 py-2 mb-4">{error}</p> : null}

      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={openCreate} className="w-full sm:w-auto">
          + {t.add}
        </Button>
      </div>

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
                <th className="px-4 py-3 font-medium">{t.colRemarks}</th>
                <th className="px-4 py-3 font-medium">{t.colTables}</th>
                <th className="px-4 py-3 font-medium text-right w-[14rem]">{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((row, index) => {
                const labels = tableLabelsForGroup(row.id);
                return (
                  <tr key={row.id} className="border-b border-brand-border/80 last:border-0">
                    <td className="px-4 py-3 font-medium text-brand-text">{row.name}</td>
                    <td className="px-4 py-3 text-brand-text-muted max-w-[12rem] truncate">
                      {row.remarks || '—'}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-brand-text-muted">
                      {labels.length === 0
                        ? t.tablesEmpty
                        : t.tablesSummary.replace('{count}', String(labels.length))}
                      {labels.length > 0 ? (
                        <p className="mt-1 text-[12px] truncate max-w-[16rem]">{labels.join(', ')}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label={t.moveUp}
                          disabled={index === 0}
                          onClick={() => void moveRow(index, -1)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-brand-border/70 text-brand-text-muted hover:text-brand-gold disabled:opacity-35"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={t.moveDown}
                          disabled={index === groups.length - 1}
                          onClick={() => void moveRow(index, 1)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-brand-border/70 text-brand-text-muted hover:text-brand-gold disabled:opacity-35"
                        >
                          ↓
                        </button>
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
