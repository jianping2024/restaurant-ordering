'use client';

import { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { IntegerInput } from '@/components/ui/IntegerInput';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { showToast } from '@/components/ui/Toast';
import {
  RESTAURANT_TABLE_LIST_MAX,
  compareRestaurantTables,
  isValidTableDisplayName,
  normalizeTableDisplayName,
  sortRestaurantTables,
  tableIdsEqual,
  isValidTableAddCount,
  type RestaurantTableRow,
} from '@/lib/restaurant-tables';

interface TablesManagerProps {
  restaurant: { id: string; slug: string; name: string };
  initialTables: RestaurantTableRow[];
  embedded?: boolean;
}

type ActiveSessionRow = {
  id: string;
  table_id: string;
  display_name: string;
  status: 'open' | 'billing' | 'closed';
  opened_at: string;
};

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

export function TablesManager({ restaurant, initialTables, embedded }: TablesManagerProps) {
  const { lang } = useLanguage();
  const t = getMessages(lang).tables;
  const tPrint = getMessages(lang).printStations;
  const supabase = createClient();

  const [tables, setTables] = useState<RestaurantTableRow[]>(() => sortRestaurantTables(initialTables));
  const [savedTables, setSavedTables] = useState<RestaurantTableRow[]>(() => sortRestaurantTables(initialTables));
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addCount, setAddCount] = useState(1);
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});

  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [staffLoginQr, setStaffLoginQr] = useState('');
  const [activeSessions, setActiveSessions] = useState<ActiveSessionRow[]>([]);
  const [operationType, setOperationType] = useState<'transfer' | 'merge' | null>(null);
  const [sourceTableId, setSourceTableId] = useState<string | null>(null);
  const [mergeSourceTableIds, setMergeSourceTableIds] = useState<string[]>([]);
  const [targetTableId, setTargetTableId] = useState<string | null>(null);
  const [operating, setOperating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RestaurantTableRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const tableById = useMemo(
    () => new Map(tables.map((row) => [row.id, row])),
    [tables],
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

  const loadActiveSessions = async () => {
    const { data: sessions } = await supabase
      .from('table_sessions')
      .select('id, table_id, status, opened_at')
      .eq('restaurant_id', restaurant.id)
      .in('status', ['open', 'billing'])
      .order('opened_at', { ascending: true });

    const rows = (sessions || []) as Omit<ActiveSessionRow, 'display_name'>[];
    setActiveSessions(
      rows.map((session) => ({
        ...session,
        display_name: tableById.get(session.table_id)?.display_name ?? session.table_id.slice(0, 8),
      })),
    );
  };

  useEffect(() => {
    void loadActiveSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id, tableById]);

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
    link.download = `table-${displayName}-qr.png`;
    link.click();
  };

  const downloadStaffLoginQR = () => {
    if (!staffLoginQr) return;
    const link = document.createElement('a');
    link.href = staffLoginQr;
    link.download = 'staff-login-qr.png';
    link.click();
  };

  const printAll = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>${restaurant.name} — ${t.title}</title>
          <style>
            body { font-family: serif; background: white; margin: 0; padding: 20px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .item { text-align: center; page-break-inside: avoid; border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
            .item img { width: 150px; height: 150px; }
            h2 { font-size: 14px; margin: 8px 0 4px; }
            p { font-size: 11px; color: #666; margin: 0; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <button class="no-print" onclick="window.print()" style="margin-bottom:20px;padding:8px 16px;">${t.print}</button>
          <div class="grid">
            ${tables.map((row) => `
              <div class="item">
                <img src="${qrCodes[row.id] || ''}" alt="${t.table} ${row.display_name}" />
                <h2>${restaurant.name}</h2>
                <p>${t.table} ${row.display_name}</p>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `);
    win.document.close();
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
      await loadActiveSessions();
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
    const occupied = activeSessions.some((s) => tableIdsEqual(s.table_id, deleteTarget.id));
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

  const openOperation = (type: 'transfer' | 'merge', tableId: string) => {
    setOperationType(type);
    setSourceTableId(tableId);
    setMergeSourceTableIds(type === 'merge' ? [tableId] : []);
    setTargetTableId(null);
  };

  const closeOperation = () => {
    setOperationType(null);
    setSourceTableId(null);
    setMergeSourceTableIds([]);
    setTargetTableId(null);
    setOperating(false);
  };

  const handleSubmitOperation = async () => {
    if (!operationType || !targetTableId) return;

    const selectedSources =
      operationType === 'merge'
        ? mergeSourceTableIds
        : sourceTableId
          ? [sourceTableId]
          : [];
    if (selectedSources.length === 0) {
      showToast(operationType === 'merge' ? t.mergeAtLeastTwo : t.sameTableError, 'error');
      return;
    }

    if (selectedSources.some((id) => tableIdsEqual(id, targetTableId))) {
      showToast(t.sameTableError, 'error');
      return;
    }

    setOperating(true);
    try {
      const { error } =
        operationType === 'transfer'
          ? await supabase.rpc('transfer_table_session', {
              p_restaurant_id: restaurant.id,
              p_from_table_id: selectedSources[0],
              p_to_table_id: targetTableId,
            })
          : await supabase.rpc('merge_multiple_table_sessions', {
              p_restaurant_id: restaurant.id,
              p_source_table_ids: selectedSources,
              p_target_table_id: targetTableId,
            });

      if (error) {
        if ((error.message || '').toLowerCase().includes('active session')) {
          showToast(t.sessionConflict, 'error');
        } else {
          showToast(t.operationFailed, 'error');
        }
        return;
      }

      await loadActiveSessions();
      showToast(t.operationSuccess, 'success');
      closeOperation();
    } catch {
      showToast(t.operationFailed, 'error');
    } finally {
      setOperating(false);
    }
  };

  const occupiedTableIds = new Set(activeSessions.map((s) => s.table_id));
  const transferTargets = tables
    .filter(
      (row) =>
        (!sourceTableId || !tableIdsEqual(row.id, sourceTableId)) &&
        !occupiedTableIds.has(row.id),
    )
    .sort(compareRestaurantTables);
  const mergeTargets = activeSessions
    .map((s) => s.table_id)
    .filter((id) => !mergeSourceTableIds.includes(id))
    .map((id) => tableById.get(id))
    .filter((row): row is RestaurantTableRow => !!row)
    .sort(compareRestaurantTables);
  const currentTargets = operationType === 'transfer' ? transferTargets : mergeTargets;

  const qrReady = tables.length > 0 && tables.every((row) => qrCodes[row.id]);

  return (
    <div>
      {!embedded ? (
        <div className="mb-6">
          <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
          <p className="text-brand-text-muted text-sm mt-1">{t.desc}</p>
        </div>
      ) : null}

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
              <p className="text-brand-text-muted text-[13px] mb-3 truncate">
                /{restaurant.slug}/menu?table_id=…
              </p>
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => downloadQR(table.id, table.display_name)}
                    disabled={!qrCodes[table.id]}
                    className="text-[13px] text-brand-gold hover:underline disabled:opacity-50"
                  >
                    {t.download}
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
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-heading text-2xl text-brand-gold">{t.activeSessionsTitle}</h2>
            <p className="text-brand-text-muted text-sm mt-1">{t.activeSessionsDesc}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadActiveSessions()}>{t.refreshSessions}</Button>
        </div>
        {activeSessions.length === 0 ? (
          <p className="text-brand-text-muted text-sm">{t.noActiveSessions}</p>
        ) : (
          <div className="space-y-2.5">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                className="rounded-xl border border-brand-border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <p className="text-brand-text font-medium">{t.table} {session.display_name}</p>
                  <p className="text-brand-text-muted text-[13px]">
                    {new Date(session.opened_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openOperation('transfer', session.table_id)}
                    className="text-[13px] px-3 py-1.5 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
                  >
                    {t.transferAction}
                  </button>
                  <button
                    type="button"
                    onClick={() => openOperation('merge', session.table_id)}
                    className="text-[13px] px-3 py-1.5 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
                  >
                    {t.mergeAction}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
          <p className="text-brand-text-muted text-[13px] mb-3 truncate">/{restaurant.slug}/staff/login</p>
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

      <Modal
        open={!!operationType}
        onClose={closeOperation}
        title={operationType === 'transfer' ? t.transferTitle : t.mergeTitle}
        size="sm"
      >
        <p className="text-[13px] text-brand-text-muted mb-4">
          {operationType === 'transfer' ? t.transferHint : t.mergeHint}
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-[13px] text-brand-text-muted block mb-1.5">
              {operationType === 'merge' ? t.sourceTables : t.sourceTable}
            </label>
            {operationType === 'merge' ? (
              <div className="modal-scroll rounded-lg border border-brand-border bg-brand-bg p-2 max-h-40 overflow-y-auto space-y-1.5">
                {activeSessions.map((session) => {
                  const checked = mergeSourceTableIds.includes(session.table_id);
                  return (
                    <label key={session.id} className="flex items-center gap-2 text-sm text-brand-text">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setMergeSourceTableIds((prev) =>
                            e.target.checked
                              ? [...prev, session.table_id].sort((a, b) => {
                                  const ta = tableById.get(a);
                                  const tb = tableById.get(b);
                                  if (ta && tb) return compareRestaurantTables(ta, tb);
                                  return a.localeCompare(b);
                                })
                              : prev.filter((id) => id !== session.table_id),
                          );
                        }}
                        className="accent-brand-gold"
                      />
                      {t.table} {session.display_name}
                    </label>
                  );
                })}
              </div>
            ) : (
              <select
                value={sourceTableId ?? ''}
                onChange={(e) => setSourceTableId(e.target.value || null)}
                className="w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/40"
              >
                <option value="">--</option>
                {activeSessions.map((session) => (
                  <option key={session.id} value={session.table_id}>
                    {t.table} {session.display_name}
                  </option>
                ))}
              </select>
            )}
            {operationType === 'merge' && (
              <p className="mt-1.5 text-[13px] text-brand-text-muted">
                {t.selectedCount}: {mergeSourceTableIds.length}
              </p>
            )}
          </div>
          <div>
            <label className="text-[13px] text-brand-text-muted block mb-1.5">{t.targetTable}</label>
            <select
              value={targetTableId ?? ''}
              onChange={(e) => setTargetTableId(e.target.value || null)}
              className="w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/40"
            >
              <option value="">--</option>
              {currentTargets.map((row) => (
                <option key={row.id} value={row.id}>
                  {t.table} {row.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={closeOperation}>{getMessages(lang).menuManager.cancel}</Button>
          <Button
            onClick={handleSubmitOperation}
            loading={operating}
            disabled={
              operationType === 'merge'
                ? mergeSourceTableIds.length === 0 || !targetTableId
                : !sourceTableId || !targetTableId
            }
          >
            {operationType === 'transfer'
              ? (operating ? t.transferring : t.confirmTransfer)
              : (operating ? t.merging : t.confirmMerge)}
          </Button>
        </div>
      </Modal>

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
