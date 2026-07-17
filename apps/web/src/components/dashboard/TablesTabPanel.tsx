'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { showToast } from '@/components/ui/Toast';
import { StaffLoginQrSection } from '@/components/dashboard/tables/StaffLoginQrSection';
import { TableQrPreviewModal } from '@/components/dashboard/tables/TableQrPreviewModal';
import { TablesQrBatchBar } from '@/components/dashboard/tables/TablesQrBatchBar';
import { TablesQrTable } from '@/components/dashboard/tables/TablesQrTable';
import { TablesQrToolbar } from '@/components/dashboard/tables/TablesQrToolbar';
import { downloadTableQrsZip } from '@/lib/download-table-qrs';
import { buildTableQrStickerAssets } from '@/lib/build-table-qr-sticker-assets';
import { printTableQrs } from '@/lib/print-table-qrs';
import {
  buildTableGroupIdByTableId,
  sortTablesForGroupPrint,
  type RestaurantTableGroup,
  type RestaurantTableGroupMember,
} from '@/lib/restaurant-table-groups';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import {
  applyTableQrListFilters,
  isPageFullySelected,
  paginateTables,
  resolveSelectedTables,
  selectableTableIds,
  TABLE_QR_ALL_GROUPS,
  TABLE_QR_PAGE_SIZE,
} from '@/lib/table-qr-list';
import { useTableBatchSelection } from '@/lib/use-table-batch-selection';
import { useTableQrCodes } from '@/lib/use-table-qr-codes';

interface TablesTabPanelProps {
  restaurant: { slug: string; name: string; print_locale: 'zh' | 'en' | 'pt' | null };
  tables: RestaurantTableRow[];
  groups: RestaurantTableGroup[];
  members: RestaurantTableGroupMember[];
  groupNameByTableId: Record<string, string>;
  occupiedTableIds: Set<string>;
  dirty: boolean;
  dirtyCount: number;
  saving: boolean;
  adding: boolean;
  addCount: number;
  maxAddCount: number;
  deleteSuccessNonce: number;
  tableLabelForInput: (table: RestaurantTableRow) => string;
  onAddCountChange: (count: number) => void;
  onAddTables: (count: number) => void;
  onSaveTables: () => void;
  onDeleteRequest: (tables: RestaurantTableRow[]) => void;
  onLabelDraftFocus: (table: RestaurantTableRow) => void;
  onLabelDraftChange: (tableId: string, value: string) => void;
  onLabelBlur: (table: RestaurantTableRow) => void;
  onSeatChange: (tableId: string, field: 'seat_min' | 'seat_max', value: string) => void;
}

export function TablesTabPanel({
  restaurant,
  tables,
  groups,
  members,
  groupNameByTableId,
  occupiedTableIds,
  dirty,
  dirtyCount,
  saving,
  adding,
  addCount,
  maxAddCount,
  deleteSuccessNonce,
  tableLabelForInput,
  onAddCountChange,
  onAddTables,
  onSaveTables,
  onDeleteRequest,
  onLabelDraftFocus,
  onLabelDraftChange,
  onLabelBlur,
  onSeatChange,
}: TablesTabPanelProps) {
  const { lang } = useLanguage();
  const t = getMessages(lang).tables;
  const tg = getMessages(lang).tableGroups;
  const tPrint = getMessages(lang).printStations;

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState(TABLE_QR_ALL_GROUPS);
  const [page, setPage] = useState(1);
  const [previewTable, setPreviewTable] = useState<RestaurantTableRow | null>(null);
  const [previewQrSrc, setPreviewQrSrc] = useState('');
  const [batchBusy, setBatchBusy] = useState(false);

  const batch = useTableBatchSelection();

  const groupIdByTableId = useMemo(
    () => buildTableGroupIdByTableId(members),
    [members],
  );

  const filteredTables = useMemo(
    () =>
      applyTableQrListFilters(
        tables,
        { search, groupId: groupFilter },
        groupIdByTableId,
      ),
    [tables, search, groupFilter, groupIdByTableId],
  );

  const pagination = useMemo(
    () => paginateTables(filteredTables, page, TABLE_QR_PAGE_SIZE),
    [filteredTables, page],
  );

  const visibleTableIds = useMemo(
    () => pagination.rows.map((row) => row.id),
    [pagination.rows],
  );

  const { qrCodes } = useTableQrCodes(restaurant.slug, visibleTableIds);

  const { resetAfterDelete } = batch;

  useEffect(() => {
    if (deleteSuccessNonce > 0) {
      resetAfterDelete();
    }
  }, [deleteSuccessNonce, resetAfterDelete]);

  useEffect(() => {
    setPage(1);
  }, [search, groupFilter, tables.length]);

  const buildStickers = useCallback(
    async (rows: RestaurantTableRow[]) =>
      buildTableQrStickerAssets({
        slug: restaurant.slug,
        rows,
        groupNameByTableId,
        restaurantName: restaurant.name,
        printLocale: restaurant.print_locale,
        ungroupedLabel: tg.ungrouped,
        resolveDisplayName: tableLabelForInput,
      }),
    [
      groupNameByTableId,
      restaurant.name,
      restaurant.print_locale,
      restaurant.slug,
      tableLabelForInput,
      tg.ungrouped,
    ],
  );

  useEffect(() => {
    if (!previewTable) {
      setPreviewQrSrc('');
      return;
    }
    let cancelled = false;
    void buildStickers([previewTable]).then((stickers) => {
      if (!cancelled) setPreviewQrSrc(stickers[previewTable.id] ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [previewTable, buildStickers]);

  const printLabels = useMemo(
    () => ({
      title: t.title,
      table: t.table,
      printOne: t.printOne,
      printMany: t.print,
    }),
    [t.print, t.printOne, t.table, t.title],
  );

  const printRows = useCallback(
    async (rows: RestaurantTableRow[]) => {
      if (rows.length === 0) return;
      const stickers = await buildStickers(rows);
      printTableQrs({
        restaurantName: restaurant.name,
        rows,
        stickerDataUrls: stickers,
        labels: printLabels,
      });
    },
    [buildStickers, printLabels, restaurant.name],
  );

  const handlePrintAll = () => {
    void printRows(sortTablesForGroupPrint(filteredTables, groups, members));
  };

  const selectedRows = useMemo(
    () => resolveSelectedTables(tables, batch.selectedIds),
    [batch.selectedIds, tables],
  );

  const pageSelectable = useMemo(
    () => selectableTableIds(pagination.rows, occupiedTableIds),
    [occupiedTableIds, pagination.rows],
  );

  const pageFullySelected = useMemo(
    () => isPageFullySelected(pagination.rows, batch.selectedIds, occupiedTableIds),
    [batch.selectedIds, occupiedTableIds, pagination.rows],
  );

  const handleToggleSelectPage = () => {
    if (pageFullySelected) {
      batch.deselectPage(pageSelectable);
      return;
    }
    batch.selectPage(pageSelectable);
  };

  const handleBatchPrint = async () => {
    if (selectedRows.length === 0) return;
    setBatchBusy(true);
    try {
      await printRows(sortTablesForGroupPrint(selectedRows, groups, members));
    } finally {
      setBatchBusy(false);
    }
  };

  const handleBatchDownload = async () => {
    if (selectedRows.length === 0) return;
    setBatchBusy(true);
    try {
      const sorted = sortTablesForGroupPrint(selectedRows, groups, members);
      const stickers = await buildStickers(sorted);
      const count = await downloadTableQrsZip(
        sorted,
        stickers,
        t.batchDownloadZipName,
        tableLabelForInput,
      );
      if (count === 0) {
        showToast(t.batchDownloadEmpty, 'error');
        return;
      }
      showToast(t.batchDownloadSuccess.replace('{count}', String(count)), 'success');
    } catch {
      showToast(t.batchDownloadFailed, 'error');
    } finally {
      setBatchBusy(false);
    }
  };

  const handleBatchDelete = () => {
    if (selectedRows.length === 0) return;
    onDeleteRequest(selectedRows);
  };

  return (
    <>
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 mb-6">
        <TablesQrToolbar
          totalCount={tables.length}
          filteredCount={filteredTables.length}
          dirty={dirty}
          dirtyCount={dirtyCount}
          saving={saving}
          adding={adding}
          addCount={addCount}
          maxAddCount={maxAddCount}
          batchMode={batch.batchMode}
          search={search}
          groupId={groupFilter}
          groups={groups}
          labels={{
            tableQrTitle: t.tableQrTitle,
            tableCountSummary: t.tableCountSummary,
            unsavedChanges: t.unsavedChanges,
            searchTable: t.searchTable,
            clearSearch: t.clearSearch,
            allGroups: t.allGroups,
            ungrouped: tg.ungrouped,
            batchManage: t.batchManage,
            exitBatchManage: t.exitBatchManage,
            addTableCountLabel: t.addTableCountLabel,
            addTables: t.addTables,
            saveTables: t.saveTables,
            savingTables: t.savingTables,
            print: t.print,
          }}
          onSearchChange={setSearch}
          onGroupChange={setGroupFilter}
          onToggleBatchMode={batch.toggleBatchMode}
          onAddCountChange={onAddCountChange}
          onAddTables={() => onAddTables(Math.min(addCount, maxAddCount))}
          onSaveTables={onSaveTables}
          onPrintAll={handlePrintAll}
        />

        {batch.batchMode ? (
          <div className="mt-4">
            <TablesQrBatchBar
              batchMode={batch.batchMode}
              selectedCount={batch.selectedCount}
              pageFullySelected={pageFullySelected}
              busy={batchBusy}
              labels={{
                selectedTablesSummary: t.selectedTablesSummary,
                batchSelectHint: t.batchSelectHint,
                selectAllPage: t.selectAllPage,
                deselectAllPage: t.deselectAllPage,
                cancelSelection: t.cancelSelection,
                batchPrint: t.batchPrint,
                batchDownload: t.batchDownload,
                batchDelete: t.batchDelete,
              }}
              onToggleSelectPage={handleToggleSelectPage}
              onClearSelection={batch.clearSelection}
              onBatchPrint={() => void handleBatchPrint()}
              onBatchDownload={() => void handleBatchDownload()}
              onBatchDelete={handleBatchDelete}
            />
          </div>
        ) : null}

        <TablesQrTable
          restaurantSlug={restaurant.slug}
          pageRows={pagination.rows}
          batchMode={batch.batchMode}
          selectedIds={batch.selectedIds}
          occupiedTableIds={occupiedTableIds}
          groupNameByTableId={groupNameByTableId}
          qrCodes={qrCodes}
          tableLabelForInput={tableLabelForInput}
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          labels={{
            colTable: t.colTable,
            tableNumberLabel: t.tableNumberLabel,
            colSeats: t.colSeats,
            seatMin: t.seatMin,
            seatMax: t.seatMax,
            colGroup: t.colGroup,
            colQr: t.colQr,
            colActions: t.colActions,
            printOne: t.printOne,
            openOrder: t.openOrder,
            delete: tPrint.delete,
            ungrouped: tg.ungrouped,
            emptyFiltered: t.emptyFiltered,
            pageInfo: t.pageInfo,
            pagePrev: t.pagePrev,
            pageNext: t.pageNext,
            cannotRemoveWithSession: t.cannotRemoveWithSession,
          }}
          onToggleRow={batch.toggleRow}
          onLabelDraftFocus={onLabelDraftFocus}
          onLabelDraftChange={onLabelDraftChange}
          onLabelBlur={onLabelBlur}
          onSeatChange={onSeatChange}
          onPreview={setPreviewTable}
          onPrintRow={(table) => void printRows([table])}
          onDeleteRow={(table) => onDeleteRequest([table])}
          onPageChange={setPage}
        />
      </div>

      <StaffLoginQrSection slug={restaurant.slug} />

      <TableQrPreviewModal
        open={!!previewTable}
        target={
          previewTable && previewQrSrc
            ? {
                table: previewTable,
                stickerSrc: previewQrSrc,
              }
            : null
        }
        restaurantSlug={restaurant.slug}
        labels={{
          title: t.qrPreviewTitle,
          table: t.table,
          openOrder: t.openOrder,
        }}
        onClose={() => setPreviewTable(null)}
      />
    </>
  );
}
