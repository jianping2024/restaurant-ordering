'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { IntegerInput } from '@/components/ui/IntegerInput';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  sortTablesForGroupPrint,
  type RestaurantTableGroup,
  type RestaurantTableGroupMember,
} from '@/lib/restaurant-table-groups';
import { RESTAURANT_TABLE_LIST_MAX, type RestaurantTableRow } from '@/lib/restaurant-tables';
import {
  buildTableMenuQrUrl,
  buildStaffLoginQrUrl,
  tableQrDownloadFilename,
} from '@/lib/table-menu-qr';
import { useStaffLoginQr, useTableQrCodes } from '@/lib/use-table-qr-codes';

interface TablesTabPanelProps {
  restaurant: { slug: string; name: string };
  tables: RestaurantTableRow[];
  groups: RestaurantTableGroup[];
  members: RestaurantTableGroupMember[];
  groupNameByTableId: Record<string, string>;
  occupiedTableIds: Set<string>;
  dirty: boolean;
  saving: boolean;
  adding: boolean;
  addCount: number;
  maxAddCount: number;
  tableLabelForInput: (table: RestaurantTableRow) => string;
  onAddCountChange: (count: number) => void;
  onAddTables: (count: number) => void;
  onSaveTables: () => void;
  onDeleteRequest: (tables: RestaurantTableRow[]) => void;
  onLabelDraftFocus: (table: RestaurantTableRow) => void;
  onLabelDraftChange: (tableId: string, value: string) => void;
  onLabelBlur: (table: RestaurantTableRow) => void;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function TablesTabPanel({
  restaurant,
  tables,
  groups,
  members,
  groupNameByTableId,
  occupiedTableIds,
  dirty,
  saving,
  adding,
  addCount,
  maxAddCount,
  tableLabelForInput,
  onAddCountChange,
  onAddTables,
  onSaveTables,
  onDeleteRequest,
  onLabelDraftFocus,
  onLabelDraftChange,
  onLabelBlur,
}: TablesTabPanelProps) {
  const { lang } = useLanguage();
  const t = getMessages(lang).tables;
  const tPrint = getMessages(lang).printStations;

  const tableIds = useMemo(() => tables.map((row) => row.id), [tables]);
  const { qrCodes, ensureAll } = useTableQrCodes(restaurant.slug, tableIds);
  const staffLoginQr = useStaffLoginQr(restaurant.slug);

  const printTables = async (rows: RestaurantTableRow[]) => {
    if (rows.length === 0) return;
    const codes = await ensureAll();
    const printable = rows.filter((row) => codes[row.id]);
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
            ${printable
              .map((row) => {
                const qrSrc = codes[row.id];
                const groupName = groupNameByTableId[row.id];
                return `
              <div class="item${single ? ' item-single' : ''}">
                <p class="table-no-large">${escapeHtml(row.display_name)}</p>
                ${groupName ? `<p class="group-name">${escapeHtml(groupName)}</p>` : ''}
                <img src="${qrSrc}" alt="${escapeHtml(`${t.table} ${row.display_name}`)}" />
                <h2>${escapeHtml(restaurant.name)}</h2>
              </div>
            `;
              })
              .join('')}
          </div>
        </body>
      </html>
    `);
    win.document.close();
  };

  const downloadQR = (tableId: string, displayName: string) => {
    const href = qrCodes[tableId];
    if (!href) return;
    const link = document.createElement('a');
    link.href = href;
    link.download = tableQrDownloadFilename(displayName);
    link.click();
  };

  const downloadStaffLoginQR = () => {
    if (!staffLoginQr) return;
    const link = document.createElement('a');
    link.href = staffLoginQr;
    link.download = 'staff-login-qr.png';
    link.click();
  };

  return (
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
                {dirty ? <span className="text-brand-gold"> · {t.unsavedChanges}</span> : null}
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
                  onChange={(n) => onAddCountChange(Math.max(1, Math.min(n, maxAddCount)))}
                  className="w-16 rounded-lg bg-brand-bg border border-brand-border px-2 py-1.5 text-center text-sm text-brand-text focus:outline-none focus:border-brand-gold/40"
                  aria-label={t.addTableCountLabel}
                />
              </div>
              <Button
                onClick={() => onAddTables(Math.min(addCount, maxAddCount))}
                size="sm"
                variant="outline"
                loading={adding}
                disabled={adding || tables.length >= RESTAURANT_TABLE_LIST_MAX}
              >
                {t.addTables}
              </Button>
              <Button onClick={onSaveTables} size="sm" loading={saving} disabled={!dirty || saving}>
                {saving ? t.savingTables : t.saveTables}
              </Button>
              <Button
                onClick={() => void printTables(sortTablesForGroupPrint(tables, groups, members))}
                variant="outline"
                size="sm"
                disabled={tables.length === 0}
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
                onFocus={() => onLabelDraftFocus(table)}
                onChange={(e) => onLabelDraftChange(table.id, e.target.value)}
                onBlur={() => onLabelBlur(table)}
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
                    onClick={() => void printTables([table])}
                    disabled={!qrCodes[table.id]}
                    className="text-[13px] text-brand-gold hover:underline disabled:opacity-50"
                  >
                    {t.printOne}
                  </button>
                  <a
                    href={buildTableMenuQrUrl(restaurant.slug, table.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] text-brand-gold hover:underline"
                  >
                    {t.openOrder}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteRequest([table])}
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
              href={buildStaffLoginQrUrl(restaurant.slug)}
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
  );
}
