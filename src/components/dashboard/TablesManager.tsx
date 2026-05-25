'use client';

import { useState, useEffect, useCallback } from 'react';
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
  RESTAURANT_TABLE_VALUE_MAX,
  RESTAURANT_TABLE_VALUE_MIN,
  isValidTableNumberValue,
  normalizeRestaurantTableNumbers,
  resizeTableNumbersList,
} from '@/lib/restaurant-table-numbers';

interface TablesManagerProps {
  restaurant: { id: string; slug: string; name: string };
  initialTableNumbers?: number[] | null;
  embedded?: boolean;
}

export function TablesManager({ restaurant, initialTableNumbers, embedded }: TablesManagerProps) {
  const { lang } = useLanguage();
  const t = getMessages(lang).tables;
  const supabase = createClient();

  const [tableNumbers, setTableNumbers] = useState<number[]>(() =>
    normalizeRestaurantTableNumbers(initialTableNumbers),
  );
  const [savedTableNumbers, setSavedTableNumbers] = useState<number[]>(() =>
    normalizeRestaurantTableNumbers(initialTableNumbers),
  );
  const [saving, setSaving] = useState(false);

  const [qrCodes, setQrCodes] = useState<Record<number, string>>({});
  const [staffLoginQr, setStaffLoginQr] = useState('');
  const [activeSessions, setActiveSessions] = useState<Array<{
    id: string;
    table_number: number;
    status: 'open' | 'billing' | 'closed';
    opened_at: string;
  }>>([]);
  const [operationType, setOperationType] = useState<'transfer' | 'merge' | null>(null);
  const [sourceTable, setSourceTable] = useState<number | null>(null);
  const [mergeSourceTables, setMergeSourceTables] = useState<number[]>([]);
  const [targetTable, setTargetTable] = useState<number | null>(null);
  const [operating, setOperating] = useState(false);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const dirty =
    tableNumbers.length !== savedTableNumbers.length
    || tableNumbers.some((n, i) => n !== savedTableNumbers[i]);

  const loadActiveSessions = async () => {
    const { data } = await supabase
      .from('table_sessions')
      .select('id, table_number, status, opened_at')
      .eq('restaurant_id', restaurant.id)
      .in('status', ['open', 'billing'])
      .order('table_number', { ascending: true });

    setActiveSessions((data as typeof activeSessions) || []);
  };

  useEffect(() => {
    loadActiveSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  useEffect(() => {
    const generate = async () => {
      const codes: Record<number, string> = {};
      for (const tableNum of tableNumbers) {
        const url = `${baseUrl}/${restaurant.slug}/menu?table=${tableNum}`;
        codes[tableNum] = await QRCode.toDataURL(url, {
          width: 200,
          margin: 2,
          color: { dark: '#0f0e0c', light: '#f5f0e8' },
        });
      }
      setQrCodes(codes);
    };
    void generate();
  }, [tableNumbers, restaurant.slug, baseUrl]);

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

  const downloadQR = (tableNum: number) => {
    const link = document.createElement('a');
    link.href = qrCodes[tableNum];
    link.download = `table-${tableNum}-qr.png`;
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
            ${tableNumbers.map(n => `
              <div class="item">
                <img src="${qrCodes[n] || ''}" alt="${t.table} ${n}" />
                <h2>${restaurant.name}</h2>
                <p>${t.table} ${n}</p>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleCountChange = (count: number) => {
    setTableNumbers((prev) => resizeTableNumbersList(prev, count));
  };

  const handleTableNumberAtIndex = (index: number, next: number) => {
    if (!isValidTableNumberValue(next)) {
      showToast(t.invalidTableNumber, 'error');
      return;
    }
    setTableNumbers((prev) => {
      if (prev.some((n, i) => i !== index && n === next)) {
        showToast(t.duplicateTableNumber, 'error');
        return prev;
      }
      const copy = [...prev];
      copy[index] = next;
      return copy;
    });
  };

  const saveTableNumbers = useCallback(async () => {
    const occupied = new Set(activeSessions.map((s) => s.table_number));
    const removed = savedTableNumbers.filter((n) => !tableNumbers.includes(n));
    if (removed.some((n) => occupied.has(n))) {
      showToast(t.cannotRemoveWithSession, 'error');
      return;
    }

    const renames: Array<{ from: number; to: number }> = [];
    const overlap = Math.min(savedTableNumbers.length, tableNumbers.length);
    for (let i = 0; i < overlap; i += 1) {
      const from = savedTableNumbers[i];
      const to = tableNumbers[i];
      if (from !== to) renames.push({ from, to });
    }

    setSaving(true);
    try {
      for (const { from, to } of renames) {
        const { error } = await supabase.rpc('rename_restaurant_table_number', {
          p_restaurant_id: restaurant.id,
          p_from_table: from,
          p_to_table: to,
        });
        if (error) {
          const msg = (error.message || '').toLowerCase();
          if (msg.includes('active_session') || msg.includes('target_table')) {
            showToast(t.sessionConflict, 'error');
          } else {
            showToast(t.saveFailed, 'error');
          }
          return;
        }
      }

      const { error } = await supabase
        .from('restaurants')
        .update({ table_numbers: tableNumbers })
        .eq('id', restaurant.id);

      if (error) {
        showToast(t.saveFailed, 'error');
        return;
      }

      setSavedTableNumbers([...tableNumbers]);
      await loadActiveSessions();
      showToast(t.savedTables, 'success');
    } catch {
      showToast(t.saveFailed, 'error');
    } finally {
      setSaving(false);
    }
  }, [
    activeSessions,
    restaurant.id,
    savedTableNumbers,
    supabase,
    t,
    tableNumbers,
  ]);

  const openOperation = (type: 'transfer' | 'merge', tableNum: number) => {
    setOperationType(type);
    setSourceTable(tableNum);
    setMergeSourceTables(type === 'merge' ? [tableNum] : []);
    setTargetTable(null);
  };

  const closeOperation = () => {
    setOperationType(null);
    setSourceTable(null);
    setMergeSourceTables([]);
    setTargetTable(null);
    setOperating(false);
  };

  const handleSubmitOperation = async () => {
    if (!operationType || !targetTable) return;

    const selectedSources = operationType === 'merge' ? mergeSourceTables : (sourceTable ? [sourceTable] : []);
    if (selectedSources.length === 0) {
      showToast(operationType === 'merge' ? t.mergeAtLeastTwo : t.sameTableError, 'error');
      return;
    }

    if (selectedSources.includes(targetTable)) {
      showToast(t.sameTableError, 'error');
      return;
    }

    setOperating(true);
    try {
      const { error } = operationType === 'transfer'
        ? await supabase.rpc('transfer_table_session', {
          p_restaurant_id: restaurant.id,
          p_from_table: selectedSources[0],
          p_to_table: targetTable,
        })
        : await supabase.rpc('merge_multiple_table_sessions', {
          p_restaurant_id: restaurant.id,
          p_source_tables: selectedSources,
          p_target_table: targetTable,
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

  const occupiedTables = new Set(activeSessions.map(s => s.table_number));
  const transferTargets = tableNumbers
    .filter(tableNum => tableNum !== sourceTable && !occupiedTables.has(tableNum));
  const mergeTargets = activeSessions
    .map(s => s.table_number)
    .filter(tableNum => !mergeSourceTables.includes(tableNum))
    .sort((a, b) => a - b);
  const currentTargets = operationType === 'transfer' ? transferTargets : mergeTargets;

  const qrReady = tableNumbers.length > 0 && tableNumbers.every((n) => qrCodes[n]);

  return (
    <div>
      {!embedded ? (
        <div className="mb-6">
          <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
          <p className="text-brand-text-muted text-sm mt-1">{t.desc}</p>
        </div>
      ) : null}

      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
          <div className="min-w-0">
            <h2 className="font-heading text-2xl text-brand-gold">{t.tableQrTitle}</h2>
            <p className="text-brand-text-muted text-sm mt-1">{t.tableQrDesc}</p>
          </div>
          <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0">
            <Button
              onClick={saveTableNumbers}
              size="sm"
              className="w-full sm:w-auto"
              loading={saving}
              disabled={!dirty || saving}
            >
              {saving ? t.savingTables : t.saveTables}
            </Button>
            <Button
              onClick={printAll}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={!qrReady}
            >
              {t.print}
            </Button>
          </div>
        </div>
        <label className="text-sm text-brand-text-muted font-medium block mb-2">{t.count}</label>
        <div className="flex items-center gap-3 mb-6 max-w-[12rem]">
          <IntegerInput
            value={tableNumbers.length}
            onChange={handleCountChange}
            min={1}
            max={RESTAURANT_TABLE_LIST_MAX}
            className="w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/40"
            aria-label={t.count}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {tableNumbers.map((tableNum, index) => (
          <div
            key={`${index}-${tableNum}`}
            className="bg-brand-bg border border-brand-border rounded-xl p-4 text-center"
          >
            <label className="text-[13px] text-brand-text-muted block mb-1.5">{t.tableNumberLabel}</label>
            <IntegerInput
              value={tableNum}
              onChange={(next) => handleTableNumberAtIndex(index, next)}
              min={RESTAURANT_TABLE_VALUE_MIN}
              max={RESTAURANT_TABLE_VALUE_MAX}
              className="w-full max-w-[5.5rem] mx-auto rounded-lg bg-brand-card border border-brand-border px-2 py-1.5 text-center text-brand-gold font-heading text-lg focus:outline-none focus:border-brand-gold/40 mb-3"
              aria-label={`${t.tableNumberLabel} ${tableNum}`}
            />
            {qrCodes[tableNum] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrCodes[tableNum]}
                alt={`${t.table} ${tableNum} QR`}
                className="mx-auto rounded-lg mb-3 w-32 h-32"
              />
            ) : (
              <div className="w-32 h-32 mx-auto bg-brand-border rounded-lg mb-3 animate-pulse" />
            )}
            <p className="text-brand-text-muted text-[13px] mb-3 truncate">
              /{restaurant.slug}/menu?table={tableNum}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => downloadQR(tableNum)}
                disabled={!qrCodes[tableNum]}
                className="text-[13px] text-brand-gold hover:underline disabled:opacity-50"
              >
                {t.download}
              </button>
              <a
                href={`${baseUrl}/${restaurant.slug}/menu?table=${tableNum}`}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] text-brand-gold hover:underline"
              >
                {t.openOrder}
              </a>
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
          <Button variant="outline" size="sm" onClick={loadActiveSessions}>{t.refreshSessions}</Button>
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
                  <p className="text-brand-text font-medium">{t.table} {session.table_number}</p>
                  <p className="text-brand-text-muted text-[13px]">
                    {new Date(session.opened_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openOperation('transfer', session.table_number)}
                    className="text-[13px] px-3 py-1.5 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors"
                  >
                    {t.transferAction}
                  </button>
                  <button
                    type="button"
                    onClick={() => openOperation('merge', session.table_number)}
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
                  const checked = mergeSourceTables.includes(session.table_number);
                  return (
                    <label key={session.id} className="flex items-center gap-2 text-sm text-brand-text">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setMergeSourceTables(prev => e.target.checked
                            ? [...prev, session.table_number].sort((a, b) => a - b)
                            : prev.filter(table => table !== session.table_number));
                        }}
                        className="accent-brand-gold"
                      />
                      {t.table} {session.table_number}
                    </label>
                  );
                })}
              </div>
            ) : (
              <select
                value={sourceTable ?? ''}
                onChange={(e) => setSourceTable(Number(e.target.value) || null)}
                className="w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/40"
              >
                <option value="">--</option>
                {activeSessions.map((session) => (
                  <option key={session.id} value={session.table_number}>
                    {t.table} {session.table_number}
                  </option>
                ))}
              </select>
            )}
            {operationType === 'merge' && (
              <p className="mt-1.5 text-[13px] text-brand-text-muted">
                {t.selectedCount}: {mergeSourceTables.length}
              </p>
            )}
          </div>
          <div>
            <label className="text-[13px] text-brand-text-muted block mb-1.5">{t.targetTable}</label>
            <select
              value={targetTable ?? ''}
              onChange={(e) => setTargetTable(Number(e.target.value) || null)}
              className="w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/40"
            >
              <option value="">--</option>
              {currentTargets.map((tableNum) => (
                <option key={tableNum} value={tableNum}>
                  {t.table} {tableNum}
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
            disabled={operationType === 'merge'
              ? mergeSourceTables.length === 0 || !targetTable
              : !sourceTable || !targetTable}
          >
            {operationType === 'transfer'
              ? (operating ? t.transferring : t.confirmTransfer)
              : (operating ? t.merging : t.confirmMerge)}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
