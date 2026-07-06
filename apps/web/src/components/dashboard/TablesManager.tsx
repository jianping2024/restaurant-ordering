'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { PasswordConfirmDialog } from '@/components/ui/PasswordConfirmDialog';
import { BuffetSettingsTabs } from '@/components/dashboard/buffet/BuffetSettingsTabs';
import { TableGroupsManager } from '@/components/dashboard/TableGroupsManager';
import { TablesTabPanel } from '@/components/dashboard/TablesTabPanel';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { showToast } from '@/components/ui/Toast';
import {
  buildTableGroupNameByTableId,
  type RestaurantTableGroup,
  type RestaurantTableGroupMember,
} from '@/lib/restaurant-table-groups';
import {
  RESTAURANT_TABLE_LIST_MAX,
  DEFAULT_TABLE_SEAT_MIN,
  DEFAULT_TABLE_SEAT_MAX,
  isValidTableDisplayName,
  mergeTableLabelDrafts,
  hasUnsavedRestaurantTableChanges,
  pickDirtyRestaurantTables,
  prepareRestaurantTableSettingsSave,
  normalizeTableDisplayName,
  normalizeTableSeatCount,
  sortRestaurantTables,
  isValidTableAddCount,
  type RestaurantTableRow,
} from '@/lib/restaurant-tables';
import { removeTableQrCache } from '@/lib/table-menu-qr';
import {
  loadSavedTablesManagerTab,
  saveTablesManagerTab,
  TABLES_MANAGER_DEFAULT_TAB,
  tablesManagerPath,
  type TablesManagerTab,
} from '@/lib/tables-manager-tab-preference';

interface TablesManagerProps {
  restaurant: { id: string; slug: string; name: string };
  initialTables: RestaurantTableRow[];
  initialGroups: RestaurantTableGroup[];
  initialMembers: RestaurantTableGroupMember[];
  initialOccupiedTableIds?: string[];
  initialTab?: TablesManagerTab;
}

type TablesApiResponse = {
  tables?: RestaurantTableRow[];
  error?: string;
  display_names?: string[];
};

async function requestDashboardTables(
  method: 'POST' | 'PATCH',
  body: Record<string, unknown>,
): Promise<RestaurantTableRow[] | null> {
  const res = await fetch('/api/dashboard/tables', {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as TablesApiResponse;
  if (!res.ok || !data.tables) return null;
  return sortRestaurantTables(data.tables);
}

async function requestDeleteTables(
  tableIds: string[],
  password: string,
): Promise<
  | { ok: true; tables: RestaurantTableRow[] }
  | { ok: false; error: string; displayNames?: string[] }
> {
  const res = await fetch('/api/dashboard/tables', {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table_ids: tableIds, password }),
  });
  const data = (await res.json().catch(() => ({}))) as TablesApiResponse;
  if (res.ok && data.tables) {
    return { ok: true, tables: sortRestaurantTables(data.tables) };
  }
  return {
    ok: false,
    error: data.error ?? 'delete_failed',
    displayNames: data.display_names,
  };
}

function formatTableDeleteMessage(
  targets: RestaurantTableRow[],
  t: ReturnType<typeof getMessages>['tables'],
): string {
  if (targets.length === 1) {
    return t.confirmDeleteBodySingle.replace('{name}', targets[0].display_name);
  }
  const preview = targets
    .slice(0, 5)
    .map((row) => row.display_name)
    .join('、');
  const names = targets.length > 5 ? `${preview}…` : preview;
  return t.confirmDeleteBodyBatch
    .replace('{count}', String(targets.length))
    .replace('{names}', names);
}

export function TablesManager({
  restaurant,
  initialTables,
  initialGroups,
  initialMembers,
  initialOccupiedTableIds = [],
  initialTab = TABLES_MANAGER_DEFAULT_TAB,
}: TablesManagerProps) {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).tables;
  const tg = getMessages(lang).tableGroups;
  const tCommon = getMessages(lang).menuManager;
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<TablesManagerTab>(initialTab);
  const [groups, setGroups] = useState<RestaurantTableGroup[]>(initialGroups);
  const [members, setMembers] = useState<RestaurantTableGroupMember[]>(initialMembers);

  const [tables, setTables] = useState<RestaurantTableRow[]>(() => sortRestaurantTables(initialTables));
  const [savedTables, setSavedTables] = useState<RestaurantTableRow[]>(() => sortRestaurantTables(initialTables));
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addCount, setAddCount] = useState(1);
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});

  const [occupiedTableIds, setOccupiedTableIds] = useState<Set<string>>(
    () => new Set(initialOccupiedTableIds),
  );
  const [pendingDelete, setPendingDelete] = useState<RestaurantTableRow[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccessNonce, setDeleteSuccessNonce] = useState(0);
  const openCreateGroupRef = useRef<(() => void) | null>(null);

  const groupNameByTableId = useMemo(
    () => buildTableGroupNameByTableId(groups, members),
    [groups, members],
  );

  useEffect(() => {
    const saved = loadSavedTablesManagerTab(restaurant.id) ?? initialTab;
    setActiveTab(saved);
  }, [restaurant.id, initialTab]);

  const handleTabChange = useCallback(
    (tab: TablesManagerTab) => {
      setActiveTab(tab);
      saveTablesManagerTab(restaurant.id, tab);
      router.replace(tablesManagerPath(tab), { scroll: false });
    },
    [restaurant.id, router],
  );

  const handleGroupsChange = useCallback(
    (nextGroups: RestaurantTableGroup[], nextMembers: RestaurantTableGroupMember[]) => {
      setGroups(nextGroups);
      setMembers(nextMembers);
    },
    [],
  );

  const managerTabs = useMemo(
    () => [
      { id: 'tables', label: tg.tabTables },
      { id: 'groups', label: tg.tabGroups },
    ],
    [tg.tabGroups, tg.tabTables],
  );

  const dirtyCount = useMemo(
    () => pickDirtyRestaurantTables(tables, savedTables, labelDrafts).length,
    [labelDrafts, savedTables, tables],
  );

  const dirty = useMemo(
    () => hasUnsavedRestaurantTableChanges(tables, savedTables, labelDrafts),
    [labelDrafts, savedTables, tables],
  );

  const refreshOccupiedTableIds = useCallback(async () => {
    const { data: sessions } = await supabase
      .from('table_sessions')
      .select('table_id')
      .eq('restaurant_id', restaurant.id)
      .in('status', ['open', 'billing']);

    setOccupiedTableIds(new Set((sessions || []).map((row) => row.table_id as string)));
  }, [restaurant.id, supabase]);

  const tableLabelForInput = (table: RestaurantTableRow) =>
    labelDrafts[table.id] ?? table.display_name;

  const commitTableLabel = (tableId: string, raw: string): boolean => {
    const next = normalizeTableDisplayName(raw);
    const revert = savedTables.find((row) => row.id === tableId)?.display_name ?? '';

    if (!isValidTableDisplayName(next)) {
      showToast(t.invalidTableNumber, 'error');
      setTables((prev) =>
        prev.map((row) => (row.id === tableId ? { ...row, display_name: revert } : row)),
      );
      return false;
    }
    const merged = mergeTableLabelDrafts(tables, labelDrafts);
    if (merged.some((row) => row.id !== tableId && row.display_name === next)) {
      showToast(t.duplicateTableNumber, 'error');
      setTables((prev) =>
        prev.map((row) => (row.id === tableId ? { ...row, display_name: revert } : row)),
      );
      return false;
    }
    setTables((prev) =>
      prev.map((row) => (row.id === tableId ? { ...row, display_name: next } : row)),
    );
    return true;
  };

  const blurTableLabel = (table: RestaurantTableRow) => {
    const raw = labelDrafts[table.id] ?? table.display_name;
    commitTableLabel(table.id, raw);
    setLabelDrafts((prev) => {
      if (!(table.id in prev)) return prev;
      const next = { ...prev };
      delete next[table.id];
      return next;
    });
  };

  const updateTableSeats = (tableId: string, field: 'seat_min' | 'seat_max', raw: string) => {
    const parsed = normalizeTableSeatCount(
      raw,
      field === 'seat_min' ? DEFAULT_TABLE_SEAT_MIN : DEFAULT_TABLE_SEAT_MAX,
    );
    setTables((prev) =>
      prev.map((row) => (row.id === tableId ? { ...row, [field]: parsed } : row)),
    );
  };

  const saveTables = async () => {
    const prepared = prepareRestaurantTableSettingsSave(tables, savedTables, labelDrafts);
    if ('error' in prepared) {
      if (prepared.error === 'invalid_label') showToast(t.invalidTableNumber, 'error');
      else if (prepared.error === 'invalid_seat') showToast(t.invalidSeatRange, 'error');
      else showToast(t.duplicateTableNumber, 'error');
      return;
    }
    if (prepared.patches.length === 0) return;

    setTables(prepared.merged);
    setLabelDrafts({});

    setSaving(true);
    try {
      const next = await requestDashboardTables('PATCH', { tables: prepared.patches });
      if (!next) {
        showToast(t.saveFailed, 'error');
        return;
      }

      setTables(next);
      setSavedTables(next);
      await refreshOccupiedTableIds();
      showToast(t.savedTables, 'success');
    } catch {
      showToast(t.saveFailed, 'error');
    } finally {
      setSaving(false);
    }
  };

  const maxAddCount = Math.max(1, RESTAURANT_TABLE_LIST_MAX - tables.length);

  const addTables = async (count: number) => {
    if (!isValidTableAddCount(count, tables.length)) {
      showToast(t.saveFailed, 'error');
      return;
    }
    setAdding(true);
    try {
      const next = await requestDashboardTables('POST', { count });
      if (!next) {
        showToast(t.saveFailed, 'error');
        return;
      }
      setTables(next);
      setSavedTables(next);
      showToast(t.tablesAdded.replace('{count}', String(next.length - tables.length)), 'success');
    } catch {
      showToast(t.saveFailed, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteRequest = useCallback(
    (rows: RestaurantTableRow[]) => {
      if (rows.length === 0) return;
      const blocked = rows.filter((row) => occupiedTableIds.has(row.id));
      if (blocked.length > 0) {
        showToast(t.cannotRemoveWithSession, 'error');
        return;
      }
      setDeleteError(null);
      setPendingDelete(rows);
    },
    [occupiedTableIds, t.cannotRemoveWithSession],
  );

  const closeDeleteDialog = useCallback(() => {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteError(null);
  }, [deleting]);

  const confirmDeleteTables = async (password: string) => {
    if (!pendingDelete || pendingDelete.length === 0) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await requestDeleteTables(
        pendingDelete.map((row) => row.id),
        password,
      );
      if (!result.ok) {
        if (result.error === 'invalid_password') {
          setDeleteError(t.invalidDeletePassword);
          return;
        }
        if (result.error === 'tables_have_active_sessions') {
          const names = (result.displayNames ?? []).join('、');
          setDeleteError(t.tablesHaveActiveSessions.replace('{names}', names));
          await refreshOccupiedTableIds();
          return;
        }
        showToast(t.deleteFailed, 'error');
        return;
      }

      for (const row of pendingDelete) {
        removeTableQrCache(row.id);
      }
      setTables(result.tables);
      setSavedTables(result.tables);
      setPendingDelete(null);
      setDeleteSuccessNonce((n) => n + 1);
      showToast(t.tablesDeleted, 'success');
    } catch {
      showToast(t.deleteFailed, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const registerOpenCreateGroup = useCallback((openCreate: () => void) => {
    openCreateGroupRef.current = openCreate;
  }, []);

  return (
    <div>
      <h1 className="font-heading text-3xl text-brand-text mb-4">{t.title}</h1>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BuffetSettingsTabs
          tabs={managerTabs}
          activeId={activeTab}
          onChange={(id) => handleTabChange(id as TablesManagerTab)}
        />
        {activeTab === 'groups' ? (
          <Button
            type="button"
            onClick={() => openCreateGroupRef.current?.()}
            className="w-full sm:w-auto shrink-0"
          >
            + {tg.add}
          </Button>
        ) : null}
      </div>

      {activeTab === 'groups' ? (
        <TableGroupsManager
          tables={tables}
          initialGroups={groups}
          initialMembers={members}
          onGroupsChange={handleGroupsChange}
          onRegisterOpenCreate={registerOpenCreateGroup}
          hideAddButton
        />
      ) : (
        <TablesTabPanel
          restaurant={restaurant}
          tables={tables}
          groups={groups}
          members={members}
          groupNameByTableId={groupNameByTableId}
          occupiedTableIds={occupiedTableIds}
          dirty={dirty}
          dirtyCount={dirtyCount}
          saving={saving}
          adding={adding}
          addCount={addCount}
          maxAddCount={maxAddCount}
          deleteSuccessNonce={deleteSuccessNonce}
          tableLabelForInput={tableLabelForInput}
          onAddCountChange={setAddCount}
          onAddTables={(count) => void addTables(count)}
          onSaveTables={() => void saveTables()}
          onDeleteRequest={handleDeleteRequest}
          onLabelDraftFocus={(table) => {
            setLabelDrafts((prev) =>
              table.id in prev ? prev : { ...prev, [table.id]: table.display_name },
            );
          }}
          onLabelDraftChange={(tableId, value) => {
            setLabelDrafts((prev) => ({ ...prev, [tableId]: value }));
          }}
          onLabelBlur={blurTableLabel}
          onSeatChange={updateTableSeats}
        />
      )}

      <PasswordConfirmDialog
        open={!!pendingDelete}
        onClose={closeDeleteDialog}
        title={t.confirmDeleteTitle}
        message={pendingDelete ? formatTableDeleteMessage(pendingDelete, t) : ''}
        passwordLabel={t.confirmDeletePasswordLabel}
        passwordRequiredError={t.confirmDeletePasswordRequired}
        confirmLabel={t.confirmDelete}
        cancelLabel={tCommon.cancel}
        confirming={deleting}
        externalError={deleteError}
        onConfirm={confirmDeleteTables}
      />
    </div>
  );
}
