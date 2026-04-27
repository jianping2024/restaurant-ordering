'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

interface TablesManagerProps {
  restaurant: { id: string; slug: string; name: string };
}

export function TablesManager({ restaurant }: TablesManagerProps) {
  const { lang } = useLanguage();
  const [tableCount, setTableCount] = useState(10);
  const t = getMessages(lang).tables;
  const supabase = createClient();

  const [qrCodes, setQrCodes] = useState<Record<number, string>>({});
  const [staffQr, setStaffQr] = useState<{ kitchen: string; waiter: string }>({ kitchen: '', waiter: '' });
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

  // 生成所有二维码
  useEffect(() => {
    const generate = async () => {
      const codes: Record<number, string> = {};
      for (let i = 1; i <= tableCount; i++) {
        const url = `${baseUrl}/${restaurant.slug}/menu?table=${i}`;
        codes[i] = await QRCode.toDataURL(url, {
          width: 200,
          margin: 2,
          color: { dark: '#0f0e0c', light: '#f5f0e8' },
        });
      }
      setQrCodes(codes);
    };
    generate();
  }, [tableCount, restaurant.slug, baseUrl]);

  // 生成员工入口二维码（厨房 + 服务员观察）
  useEffect(() => {
    const generateStaffQr = async () => {
      const kitchenUrl = `${baseUrl}/${restaurant.slug}/kitchen`;
      const waiterUrl = `${baseUrl}/${restaurant.slug}/waiter`;
      const [kitchen, waiter] = await Promise.all([
        QRCode.toDataURL(kitchenUrl, {
          width: 220,
          margin: 2,
          color: { dark: '#0f0e0c', light: '#f5f0e8' },
        }),
        QRCode.toDataURL(waiterUrl, {
          width: 220,
          margin: 2,
          color: { dark: '#0f0e0c', light: '#f5f0e8' },
        }),
      ]);
      setStaffQr({ kitchen, waiter });
    };
    generateStaffQr();
  }, [restaurant.slug, baseUrl]);

  // 下载单个二维码
  const downloadQR = (tableNum: number) => {
    const link = document.createElement('a');
    link.href = qrCodes[tableNum];
    link.download = `table-${tableNum}-qr.png`;
    link.click();
  };

  const downloadStaffQR = (type: 'kitchen' | 'waiter') => {
    const link = document.createElement('a');
    link.href = staffQr[type];
    link.download = `${type}-entry-qr.png`;
    link.click();
  };

  // 打印全部二维码
  const printAll = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const items = Array.from({ length: tableCount }, (_, i) => i + 1);
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
            ${items.map(n => `
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
      alert(operationType === 'merge' ? t.mergeAtLeastTwo : t.sameTableError);
      return;
    }

    if (selectedSources.includes(targetTable)) {
      alert(t.sameTableError);
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
          alert(t.sessionConflict);
        } else {
          alert(t.operationFailed);
        }
        return;
      }

      await loadActiveSessions();
      alert(t.operationSuccess);
      closeOperation();
    } catch {
      alert(t.operationFailed);
    } finally {
      setOperating(false);
    }
  };

  const occupiedTables = new Set(activeSessions.map(s => s.table_number));
  const transferTargets = Array.from({ length: tableCount }, (_, idx) => idx + 1)
    .filter(tableNum => tableNum !== sourceTable && !occupiedTables.has(tableNum));
  const mergeTargets = activeSessions
    .map(s => s.table_number)
    .filter(tableNum => !mergeSourceTables.includes(tableNum))
    .sort((a, b) => a - b);
  const currentTargets = operationType === 'transfer' ? transferTargets : mergeTargets;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl text-brand-text">{t.title}</h1>
          <p className="text-brand-text-muted text-sm mt-1">{t.desc}</p>
        </div>
        <Button onClick={printAll} variant="outline" className="w-full sm:w-auto">🖨️ {t.print}</Button>
      </div>

      {/* 桌位数量设置 */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 mb-6">
        <label className="text-sm text-brand-text-muted font-medium block mb-3">{t.count}</label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={30}
            value={tableCount}
            onChange={e => setTableCount(Number(e.target.value))}
            className="flex-1 accent-brand-gold"
          />
          <span className="text-brand-gold font-heading text-2xl w-10 text-center">{tableCount}</span>
        </div>
      </div>

      {/* 活跃餐次操作 */}
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

      {/* 员工入口二维码 */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 mb-6">
        <h2 className="font-heading text-2xl text-brand-gold mb-2">{t.staffTitle}</h2>
        <p className="text-brand-text-muted text-sm mb-5">
          {t.staffDesc}
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-brand-border rounded-xl p-4 text-center">
            <p className="text-brand-text text-sm mb-3">{t.kitchenEntry}</p>
            {staffQr.kitchen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={staffQr.kitchen} alt={t.kitchenAlt} className="mx-auto rounded-lg mb-3 w-40 h-40" />
            ) : (
              <div className="w-40 h-40 mx-auto bg-brand-border rounded-lg mb-3 animate-pulse" />
            )}
            <p className="text-brand-text-muted text-[13px] mb-2 truncate">/{restaurant.slug}/kitchen</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => downloadStaffQR('kitchen')}
                disabled={!staffQr.kitchen}
                className="text-[13px] text-brand-gold hover:underline disabled:opacity-50"
              >
                {t.downloadKitchen}
              </button>
              <a
                href={`${baseUrl}/${restaurant.slug}/kitchen`}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] text-brand-gold hover:underline"
              >
                {t.openKitchen}
              </a>
            </div>
          </div>
          <div className="border border-brand-border rounded-xl p-4 text-center">
            <p className="text-brand-text text-sm mb-3">{t.waiterEntry}</p>
            {staffQr.waiter ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={staffQr.waiter} alt={t.waiterAlt} className="mx-auto rounded-lg mb-3 w-40 h-40" />
            ) : (
              <div className="w-40 h-40 mx-auto bg-brand-border rounded-lg mb-3 animate-pulse" />
            )}
            <p className="text-brand-text-muted text-[13px] mb-2 truncate">/{restaurant.slug}/waiter</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => downloadStaffQR('waiter')}
                disabled={!staffQr.waiter}
                className="text-[13px] text-brand-gold hover:underline disabled:opacity-50"
              >
                {t.downloadWaiter}
              </button>
              <a
                href={`${baseUrl}/${restaurant.slug}/waiter`}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] text-brand-gold hover:underline"
              >
                {t.openWaiter}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 二维码网格 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: tableCount }, (_, i) => i + 1).map(tableNum => (
          <div
            key={tableNum}
            className="bg-brand-card border border-brand-border rounded-2xl p-4 text-center"
          >
            <p className="text-brand-gold font-heading text-lg mb-3">{t.table} {tableNum}</p>
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
              <div className="rounded-lg border border-brand-border bg-brand-bg p-2 max-h-40 overflow-y-auto space-y-1.5">
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
