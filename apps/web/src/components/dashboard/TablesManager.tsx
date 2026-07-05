'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
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
  isValidTableDisplayName,
  normalizeTableDisplayName,
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
};

async function requestDashboardTables(
  method: 'POST' | 'PATCH' | 'DELETE',
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
  const tPrint = getMessages(lang).printStations;
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
  const [deleteTarget, setDeleteTarget] = useState<RestaurantTableRow | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  const dirty = useMemo(() => {
    if (tables.length !== savedTables.length) return true;
    const savedById = new Map(savedTables.map((row) => [row.id, row.display_name]));
    for (const row of tables) {
      const draft = labelDrafts[row.id];
      const committed = draft !== undefined ? normalizeTableDisplayName(draft) : row.display_name;
      if (committed !== savedById.get(row.id)) return true;
    }
    return false;
  }, [labelDrafts, savedTables, tables]);

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
    if (tables.some((row) => row.id !== tableId && row.display_name === next)) {
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

  const resolveTablesForSave = (): RestaurantTableRow[] | null => {
    const merged = tables.map((row) => {
      const raw = labelDrafts[row.id];
      if (raw === undefined) return row;
      const next = normalizeTableDisplayName(raw);
      if (!isValidTableDisplayName(next)) {
        showToast(t.invalidTableNumber, 'error');
        return null as unknown as RestaurantTableRow;
      }
      return { ...row, display_name: next };
    });
    if (merged.some((row) => !row)) return null;
    const names = merged.map((row) => row.display_name);
    if (new Set(names).size !== names.length) {
      showToast(t.duplicateTableNumber, 'error');
      return null;
    }
    return merged;
  };

  const saveTables = async () => {
    const resolved = resolveTablesForSave();
    if (!resolved) return;
    setTables(resolved);
    setLabelDrafts({});

    setSaving(true);
    try {
      const next = await requestDashboardTables('PATCH', { tables: resolved });
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

  const confirmDeleteTable = async () => {
    if (!deleteTarget) return;
    if (occupiedTableIds.has(deleteTarget.id)) {
      showToast(t.cannotRemoveWithSession, 'error');
      return;
    }
    setDeleting(true);
    try {
      const next = await requestDashboardTables('DELETE', { table_id: deleteTarget.id });
      if (!next) {
        showToast(t.saveFailed, 'error');
        return;
      }
      removeTableQrCache(deleteTarget.id);
      setTables(next);
      setSavedTables(next);
      setDeleteTarget(null);
      showToast(t.savedTables, 'success');
    } catch {
      showToast(t.saveFailed, 'error');
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
          saving={saving}
          adding={adding}
          addCount={addCount}
          maxAddCount={maxAddCount}
          tableLabelForInput={tableLabelForInput}
          onAddCountChange={setAddCount}
          onAddTables={(count) => void addTables(count)}
          onSaveTables={() => void saveTables()}
          onDeleteRequest={setDeleteTarget}
          onLabelDraftFocus={(table) => {
            setLabelDrafts((prev) =>
              table.id in prev ? prev : { ...prev, [table.id]: table.display_name },
            );
          }}
          onLabelDraftChange={(tableId, value) => {
            setLabelDrafts((prev) => ({ ...prev, [tableId]: value }));
          }}
          onLabelBlur={blurTableLabel}
        />
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={tPrint.confirmDeleteTitle}
        size="sm"
      >
        <p className="text-[13px] text-brand-text-muted mb-4">
          {deleteTarget
            ? `${t.table} ${deleteTarget.display_name}: QR will stop working. This cannot be undone.`
            : ''}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            {getMessages(lang).menuManager.cancel}
          </Button>
          <Button variant="danger" loading={deleting} onClick={() => void confirmDeleteTable()}>
            {tPrint.delete}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
