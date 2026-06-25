'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { IntegerInput } from '@/components/ui/IntegerInput';
import { BuffetSettingsTabs } from '@/components/dashboard/buffet/BuffetSettingsTabs';
import { TableGroupsManager } from '@/components/dashboard/TableGroupsManager';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { showToast } from '@/components/ui/Toast';
import {
  buildTableGroupNameByTableId,
  sortTablesForGroupPrint,
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
  initialTab?: TablesManagerTab;
}

type TablesApiResponse = {
  tables?: RestaurantTableRow[];
  error?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tableQrDownloadFilename(displayName: string) {
  const safe = displayName.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'table';
  return `table-${safe}-qr.png`;
}

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

  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [staffLoginQr, setStaffLoginQr] = useState('');
  const [occupiedTableIds, setOccupiedTableIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<RestaurantTableRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

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

  const loadOccupiedTableIds = async () => {
    const { data: sessions } = await supabase
      .from('table_sessions')
      .select('table_id')
      .eq('restaurant_id', restaurant.id)
      .in('status', ['open', 'billing']);

    setOccupiedTableIds(new Set((sessions || []).map((row) => row.table_id as string)));
  };

  useEffect(() => {
    void loadOccupiedTableIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  useEffect(() => {
    const generate = async () => {
      const codes: Record<string, string> = {};
      for (const table of tables) {
        const url = `${baseUrl}/${restaurant.slug}/menu?table_id=${encodeURIComponent(table.id)}`;
        codes[table.id] = await QRCode.toDataURL(url, {
          width: 200,
          margin: 2,
          color: { dark: '#0f0e0c', light: '#f5f0e8' },
        });
      }
      setQrCodes(codes);
    };
    void generate();
  }, [tables, restaurant.slug, baseUrl]);

  useEffect(() => {
    const generateStaffQr = async () => {
      const loginUrl = `${baseUrl}/${restaurant.slug}/staff/login`;
      const dataUrl = await QRCode.toDataURL(loginUrl, {
        width: 220,
        margin: 2,
        color: { dark: '#0f0e0c', light: '#f5f0e8' },
      });
      setStaffLoginQr(dataUrl);
    };
    void generateStaffQr();
  }, [restaurant.slug, baseUrl]);

  const downloadQR = (tableId: string, displayName: string) => {
    const link = document.createElement('a');
    link.href = qrCodes[tableId];
    link.download = tableQrDownloadFilename(displayName);
    link.click();
  };

  const printTables = (rows: RestaurantTableRow[]) => {
    const printable = rows.filter((row) => qrCodes[row.id]);
    if (printable.length === 0) return;

    const win = window.open('', '_blank');
    if (!win) return;

    const single = printable.length === 1;
    const printActionLabel = single ? t.printOne : t.print;

    win.document.write(`
      <html>
        <head>
          <title>${escapeHtml(restaurant.name)} — ${escapeHtml(single ? `${t.table} ${printable[0].display_name}` : t.title)}</title>
          <style>
            body { font-family: serif; background: white; margin: 0; padding: 20px; }
            .grid { display: grid; grid-template-columns: ${single ? '1fr' : 'repeat(3, 1fr)'}; gap: 20px; ${single ? 'max-width: 320px; margin: 0 auto;' : ''} }
            .item { text-align: center; page-break-inside: avoid; border: 1px solid #ddd; padding: 20px 16px; border-radius: 8px; }
            .item img { width: ${single ? '200px' : '150px'}; height: ${single ? '200px' : '150px'}; }
            .item-single { padding: 28px 24px; max-width: 320px; margin: 0 auto; }
            .table-no-large { font-size: 42px; font-weight: 700; margin: 0 0 8px; line-height: 1.1; letter-spacing: 0.02em; }
            .group-name { font-size: 18px; margin: 0 0 16px; color: #666; }
            h2 { font-size: 13px; margin: 14px 0 0; color: #444; font-weight: normal; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <button class="no-print" onclick="window.print()" style="margin-bottom:20px;padding:8px 16px;">${escapeHtml(printActionLabel)}</button>
          <div class="grid">
            ${printable.map((row) => {
              const qrSrc = qrCodes[row.id];
              const groupName = groupNameByTableId[row.id];
              return `
              <div class="item${single ? ' item-single' : ''}">
                <p class="table-no-large">${escapeHtml(row.display_name)}</p>
                ${groupName ? `<p class="group-name">${escapeHtml(groupName)}</p>` : ''}
                <img src="${qrSrc}" alt="${escapeHtml(`${t.table} ${row.display_name}`)}" />
                <h2>${escapeHtml(restaurant.name)}</h2>
              </div>
            `;
            }).join('')}
          </div>
        </body>
      </html>
    `);
    win.document.close();
  };

  const printAll = () =>
    printTables(sortTablesForGroupPrint(tables, groups, members));

  const printTable = (table: RestaurantTableRow) => printTables([table]);

  const downloadStaffLoginQR = () => {
    if (!staffLoginQr) return;
    const link = document.createElement('a');
    link.href = staffLoginQr;
    link.download = 'staff-login-qr.png';
    link.click();
  };

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
      await loadOccupiedTableIds();
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
    const occupied = occupiedTableIds.has(deleteTarget.id);
    if (occupied) {
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

  const qrReady = tables.length > 0 && tables.every((row) => qrCodes[row.id]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
        <p className="text-brand-text-muted text-sm mt-1">
          {activeTab === 'groups' ? tg.pageDesc : t.desc}
        </p>
      </div>

      <div className="mb-6">
        <BuffetSettingsTabs
          tabs={managerTabs}
          activeId={activeTab}
          onChange={(id) => handleTabChange(id as TablesManagerTab)}
        />
      </div>

      {activeTab === 'groups' ? (
        <TableGroupsManager
          restaurantId={restaurant.id}
          tables={tables}
          initialGroups={groups}
          initialMembers={members}
          onGroupsChange={handleGroupsChange}
        />
      ) : (
        <>
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 mb-6">
        <div className="flex flex-col gap-4">
          <div className="min-w-0">
            <h2 className="font-heading text-2xl text-brand-gold">{t.tableQrTitle}</h2>
            <p className="text-brand-text-muted text-sm mt-1 max-w-2xl">{t.tableQrDesc}</p>
          </div>

          <div className="flex flex-col gap-3 border-t border-brand-border/60 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-[12px] text-brand-text-muted">
                {t.tableCountSummary.replace('{count}', String(tables.length))}
                {dirty ? (
                  <span className="text-brand-gold"> · {t.unsavedChanges}</span>
                ) : null}
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-brand-text-muted whitespace-nowrap">
                  {t.addTableCountLabel}
                </label>
                <IntegerInput
                  value={Math.min(addCount, maxAddCount)}
                  min={1}
                  max={maxAddCount}
                  disabled={adding || tables.length >= RESTAURANT_TABLE_LIST_MAX}
                  onChange={(n) => setAddCount(Math.max(1, Math.min(n, maxAddCount)))}
                  className="w-16 rounded-lg bg-brand-bg border border-brand-border px-2 py-1.5 text-center text-sm text-brand-text focus:outline-none focus:border-brand-gold/40"
                  aria-label={t.addTableCountLabel}
                />
              </div>
              <Button
                onClick={() => void addTables(Math.min(addCount, maxAddCount))}
                size="sm"
                variant="outline"
                loading={adding}
                disabled={adding || tables.length >= RESTAURANT_TABLE_LIST_MAX}
              >
                {t.addTables}
              </Button>
              <Button
                onClick={saveTables}
                size="sm"
                loading={saving}
                disabled={!dirty || saving}
              >
                {saving ? t.savingTables : t.saveTables}
              </Button>
              <Button
                onClick={printAll}
                variant="outline"
                size="sm"
                disabled={!qrReady}
              >
                {t.print}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {tables.map((table) => (
            <div
              key={table.id}
              className="bg-brand-bg border border-brand-border rounded-xl p-4 text-center"
            >
              <label className="text-[13px] text-brand-text-muted block mb-1.5">{t.tableNumberLabel}</label>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                value={tableLabelForInput(table)}
                onFocus={() => {
                  setLabelDrafts((prev) =>
                    table.id in prev ? prev : { ...prev, [table.id]: table.display_name },
                  );
                }}
                onChange={(e) => {
                  setLabelDrafts((prev) => ({
                    ...prev,
                    [table.id]: e.target.value,
                  }));
                }}
                onBlur={() => blurTableLabel(table)}
                className="w-full max-w-[5.5rem] mx-auto rounded-lg bg-brand-card border border-brand-border px-2 py-1.5 text-center text-brand-gold font-heading text-lg focus:outline-none focus:border-brand-gold/40 mb-3"
                aria-label={`${t.tableNumberLabel} ${table.display_name}`}
              />
              {groupNameByTableId[table.id] ? (
                <p className="text-[12px] text-brand-text-muted mb-2">{groupNameByTableId[table.id]}</p>
              ) : null}
              {qrCodes[table.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrCodes[table.id]}
                  alt={`${t.table} ${table.display_name} QR`}
                  className="mx-auto rounded-lg mb-3 w-32 h-32"
                />
              ) : (
                <div className="w-32 h-32 mx-auto bg-brand-border rounded-lg mb-3 animate-pulse" />
              )}
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                  <button
                    type="button"
                    onClick={() => downloadQR(table.id, table.display_name)}
                    disabled={!qrCodes[table.id]}
                    className="text-[13px] text-brand-gold hover:underline disabled:opacity-50"
                  >
                    {t.download}
                  </button>
                  <button
                    type="button"
                    onClick={() => printTable(table)}
                    disabled={!qrCodes[table.id]}
                    className="text-[13px] text-brand-gold hover:underline disabled:opacity-50"
                  >
                    {t.printOne}
                  </button>
                  <a
                    href={`${baseUrl}/${restaurant.slug}/menu?table_id=${encodeURIComponent(table.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] text-brand-gold hover:underline"
                  >
                    {t.openOrder}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(table)}
                  disabled={occupiedTableIds.has(table.id)}
                  className="text-[13px] text-red-400/90 hover:underline disabled:opacity-40"
                  title={occupiedTableIds.has(table.id) ? t.cannotRemoveWithSession : undefined}
                >
                  {tPrint.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 mb-6">
        <h2 className="font-heading text-2xl text-brand-gold mb-2">{t.staffTitle}</h2>
        <p className="text-brand-text-muted text-sm mb-5">{t.staffDesc}</p>
        <div className="max-w-sm mx-auto border border-brand-border rounded-xl p-4 text-center">
          {staffLoginQr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={staffLoginQr} alt={t.staffAlt} className="mx-auto rounded-lg mb-3 w-44 h-44" />
          ) : (
            <div className="w-44 h-44 mx-auto bg-brand-border rounded-lg mb-3 animate-pulse" />
          )}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={downloadStaffLoginQR}
              disabled={!staffLoginQr}
              className="text-[13px] text-brand-gold hover:underline disabled:opacity-50"
            >
              {t.downloadStaff}
            </button>
            <a
              href={`${baseUrl}/${restaurant.slug}/staff/login`}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-brand-gold hover:underline"
            >
              {t.openStaffLogin}
            </a>
          </div>
        </div>
      </div>
        </>
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
