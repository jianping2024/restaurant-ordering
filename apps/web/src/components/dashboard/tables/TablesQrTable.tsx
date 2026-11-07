'use client';

import { PreferBrowserHttpLink } from '@/components/pwa/PreferBrowserHttpLink';
import {
  ListPaginationBar,
  type ListPaginationBarLabels,
} from '@/components/ui/ListPaginationBar';
import { buildTableMenuQrUrl } from '@/lib/table-menu-qr';
import type { ListPageSize } from '@/lib/paginate-list';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

type Props = {
  restaurantSlug: string;
  webOrigin: string;
  pageRows: RestaurantTableRow[];
  batchMode: boolean;
  selectedIds: ReadonlySet<string>;
  occupiedTableIds: ReadonlySet<string>;
  groupNameByTableId: Record<string, string>;
  qrCodes: Record<string, string>;
  tableLabelForInput: (table: RestaurantTableRow) => string;
  page: number;
  totalPages: number;
  total: number;
  pageSize: ListPageSize;
  paginationLabels: ListPaginationBarLabels;
  labels: {
    colTable: string;
    tableNumberLabel: string;
    colSeats: string;
    seatMin: string;
    seatMax: string;
    colGroup: string;
    colQr: string;
    colActions: string;
    printOne: string;
    openOrder: string;
    delete: string;
    ungrouped: string;
    emptyFiltered: string;
    cannotRemoveWithSession: string;
  };
  onToggleRow: (tableId: string) => void;
  onLabelDraftFocus: (table: RestaurantTableRow) => void;
  onLabelDraftChange: (tableId: string, value: string) => void;
  onLabelBlur: (table: RestaurantTableRow) => void;
  onSeatChange: (tableId: string, field: 'seat_min' | 'seat_max', value: string) => void;
  onPreview: (table: RestaurantTableRow) => void;
  onPrintRow: (table: RestaurantTableRow) => void;
  onDeleteRow: (table: RestaurantTableRow) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: ListPageSize) => void;
};

/** Table QR list — pagination is sole `ListPaginationBar` (no parallel prev/next). */
export function TablesQrTable({
  restaurantSlug,
  webOrigin,
  pageRows,
  batchMode,
  selectedIds,
  occupiedTableIds,
  groupNameByTableId,
  qrCodes,
  tableLabelForInput,
  page,
  totalPages,
  total,
  pageSize,
  paginationLabels,
  labels: t,
  onToggleRow,
  onLabelDraftFocus,
  onLabelDraftChange,
  onLabelBlur,
  onSeatChange,
  onPreview,
  onPrintRow,
  onDeleteRow,
  onPageChange,
  onPageSizeChange,
}: Props) {
  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-brand-border bg-brand-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed text-sm">
          <colgroup>
            {batchMode ? <col className="w-10" /> : null}
            <col className="w-[7.5rem]" />
            <col className="w-[7.25rem]" />
            <col className="w-[6.5rem]" />
            <col className="w-[3.25rem]" />
            <col />
          </colgroup>
          <thead>
            <tr className="border-b border-brand-border bg-brand-bg/80 text-left text-[11px] text-brand-text-muted">
              {batchMode ? <th className="px-2 py-1.5" /> : null}
              <th className="px-2 py-1.5 font-medium">{t.colTable}</th>
              <th className="px-2 py-1.5 font-medium">{t.colSeats}</th>
              <th className="px-2 py-1.5 font-medium">{t.colGroup}</th>
              <th className="px-2 py-1.5 font-medium">{t.colQr}</th>
              <th className="px-2 py-1.5 font-medium text-right">{t.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={batchMode ? 6 : 5}
                  className="px-3 py-8 text-center text-brand-text-muted text-sm"
                >
                  {t.emptyFiltered}
                </td>
              </tr>
            ) : (
              pageRows.map((table) => {
                const occupied = occupiedTableIds.has(table.id);
                const groupName = groupNameByTableId[table.id] ?? t.ungrouped;
                const qrSrc = qrCodes[table.id];
                return (
                  <tr
                    key={table.id}
                    className="border-b border-brand-border/60 last:border-b-0 hover:bg-brand-bg/40"
                  >
                    {batchMode ? (
                      <td className="px-2 py-1.5 align-middle">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(table.id)}
                          disabled={occupied}
                          onChange={() => onToggleRow(table.id)}
                          className="rounded border-brand-border"
                          aria-label={table.display_name}
                        />
                      </td>
                    ) : null}
                    <td className="px-2 py-1.5 align-middle">
                      <input
                        type="text"
                        inputMode="text"
                        autoComplete="off"
                        spellCheck={false}
                        value={tableLabelForInput(table)}
                        onFocus={() => onLabelDraftFocus(table)}
                        onChange={(e) => onLabelDraftChange(table.id, e.target.value)}
                        onBlur={() => onLabelBlur(table)}
                        className="w-full max-w-[7rem] rounded-md bg-brand-bg border border-brand-border px-2 py-1 text-brand-gold font-heading text-sm focus:outline-none focus:border-brand-gold/40"
                        aria-label={`${t.tableNumberLabel} ${table.display_name}`}
                      />
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={table.seat_min}
                          onChange={(e) => onSeatChange(table.id, 'seat_min', e.target.value)}
                          className="w-11 rounded-md bg-brand-bg border border-brand-border px-1.5 py-1 text-sm tabular-nums focus:outline-none focus:border-brand-gold/40"
                          aria-label={`${t.seatMin} ${table.display_name}`}
                        />
                        <span className="text-brand-text-muted text-xs">–</span>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={table.seat_max}
                          onChange={(e) => onSeatChange(table.id, 'seat_max', e.target.value)}
                          className="w-11 rounded-md bg-brand-bg border border-brand-border px-1.5 py-1 text-sm tabular-nums focus:outline-none focus:border-brand-gold/40"
                          aria-label={`${t.seatMax} ${table.display_name}`}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 align-middle text-brand-text-muted text-[13px] truncate">
                      {groupName}
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      {qrSrc ? (
                        <button
                          type="button"
                          onClick={() => onPreview(table)}
                          className="rounded border border-brand-border p-0.5 hover:border-brand-gold/50 transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={qrSrc} alt="" className="w-9 h-9 rounded" />
                        </button>
                      ) : (
                        <div className="w-9 h-9 rounded bg-brand-border animate-pulse" />
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <div className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-0.5">
                        <button
                          type="button"
                          onClick={() => onPrintRow(table)}
                          disabled={!qrSrc}
                          className="text-[12px] text-brand-gold hover:underline disabled:opacity-50"
                        >
                          {t.printOne}
                        </button>
                        <PreferBrowserHttpLink
                          href={buildTableMenuQrUrl(restaurantSlug, table.id, webOrigin)}
                          className="text-[12px] text-brand-gold hover:underline"
                        >
                          {t.openOrder}
                        </PreferBrowserHttpLink>
                        {!batchMode ? (
                          <button
                            type="button"
                            onClick={() => onDeleteRow(table)}
                            disabled={occupied}
                            className="text-[12px] text-red-400/90 hover:underline disabled:opacity-40"
                            title={occupied ? t.cannotRemoveWithSession : undefined}
                          >
                            {t.delete}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ListPaginationBar
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        labels={paginationLabels}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
