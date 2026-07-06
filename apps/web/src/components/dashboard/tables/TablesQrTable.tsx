'use client';

import { Button } from '@/components/ui/Button';
import { buildTableMenuQrUrl } from '@/lib/table-menu-qr';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

type Props = {
  restaurantSlug: string;
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
    pageInfo: string;
    pagePrev: string;
    pageNext: string;
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
};

export function TablesQrTable({
  restaurantSlug,
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
}: Props) {
  return (
    <div className="mt-5">
      <div className="overflow-x-auto rounded-xl border border-brand-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-brand-border bg-brand-bg/80 text-left text-[12px] text-brand-text-muted">
              {batchMode ? <th className="w-10 px-3 py-2.5" /> : null}
              <th className="px-3 py-2.5 font-medium">{t.colTable}</th>
              <th className="px-3 py-2.5 font-medium">{t.colSeats}</th>
              <th className="px-3 py-2.5 font-medium">{t.colGroup}</th>
              <th className="px-3 py-2.5 font-medium w-24">{t.colQr}</th>
              <th className="px-3 py-2.5 font-medium text-right">{t.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={batchMode ? 6 : 5}
                  className="px-4 py-10 text-center text-brand-text-muted text-sm"
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
                      <td className="px-3 py-3 align-middle">
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
                    <td className="px-3 py-3 align-middle">
                      <input
                        type="text"
                        inputMode="text"
                        autoComplete="off"
                        spellCheck={false}
                        value={tableLabelForInput(table)}
                        onFocus={() => onLabelDraftFocus(table)}
                        onChange={(e) => onLabelDraftChange(table.id, e.target.value)}
                        onBlur={() => onLabelBlur(table)}
                        className="w-full max-w-[7rem] rounded-lg bg-brand-card border border-brand-border px-2 py-1.5 text-brand-gold font-heading text-base focus:outline-none focus:border-brand-gold/40"
                        aria-label={`${t.tableNumberLabel} ${table.display_name}`}
                      />
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={table.seat_min}
                          onChange={(e) => onSeatChange(table.id, 'seat_min', e.target.value)}
                          className="w-14 rounded-lg bg-brand-card border border-brand-border px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:border-brand-gold/40"
                          aria-label={`${t.seatMin} ${table.display_name}`}
                        />
                        <span className="text-brand-text-muted">–</span>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={table.seat_max}
                          onChange={(e) => onSeatChange(table.id, 'seat_max', e.target.value)}
                          className="w-14 rounded-lg bg-brand-card border border-brand-border px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:border-brand-gold/40"
                          aria-label={`${t.seatMax} ${table.display_name}`}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle text-brand-text-muted">{groupName}</td>
                    <td className="px-3 py-3 align-middle">
                      {qrSrc ? (
                        <button
                          type="button"
                          onClick={() => onPreview(table)}
                          className="rounded-md border border-brand-border p-0.5 hover:border-brand-gold/50 transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={qrSrc} alt="" className="w-12 h-12 rounded" />
                        </button>
                      ) : (
                        <div className="w-12 h-12 rounded bg-brand-border animate-pulse" />
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                        <button
                          type="button"
                          onClick={() => onPrintRow(table)}
                          disabled={!qrSrc}
                          className="text-[13px] text-brand-gold hover:underline disabled:opacity-50"
                        >
                          {t.printOne}
                        </button>
                        <a
                          href={buildTableMenuQrUrl(restaurantSlug, table.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[13px] text-brand-gold hover:underline"
                        >
                          {t.openOrder}
                        </a>
                        {!batchMode ? (
                          <button
                            type="button"
                            onClick={() => onDeleteRow(table)}
                            disabled={occupied}
                            className="text-[13px] text-red-400/90 hover:underline disabled:opacity-40"
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

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-brand-text-muted">
            {t.pageInfo
              .replace('{page}', String(page))
              .replace('{totalPages}', String(totalPages))
              .replace('{total}', String(total))}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              {t.pagePrev}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              {t.pageNext}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
