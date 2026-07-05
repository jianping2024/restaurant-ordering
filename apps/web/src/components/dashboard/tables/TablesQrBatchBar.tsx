'use client';

import { Button } from '@/components/ui/Button';

type Props = {
  batchMode: boolean;
  selectedCount: number;
  pageFullySelected: boolean;
  busy: boolean;
  labels: {
    selectedTablesSummary: string;
    batchSelectHint: string;
    selectAllPage: string;
    deselectAllPage: string;
    cancelSelection: string;
    batchPrint: string;
    batchDownload: string;
    batchDelete: string;
  };
  onToggleSelectPage: () => void;
  onClearSelection: () => void;
  onBatchPrint: () => void;
  onBatchDownload: () => void;
  onBatchDelete: () => void;
};

export function TablesQrBatchBar({
  batchMode,
  selectedCount,
  pageFullySelected,
  busy,
  labels: t,
  onToggleSelectPage,
  onClearSelection,
  onBatchPrint,
  onBatchDownload,
  onBatchDelete,
}: Props) {
  if (!batchMode) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand-gold/30 bg-brand-gold/5 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p className="text-sm text-brand-text font-medium">
        {selectedCount > 0
          ? t.selectedTablesSummary.replace('{count}', String(selectedCount))
          : t.batchSelectHint}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onToggleSelectPage}>
          {pageFullySelected ? t.deselectAllPage : t.selectAllPage}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onClearSelection}>
          {t.cancelSelection}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || selectedCount === 0} onClick={onBatchPrint}>
          {t.batchPrint}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || selectedCount === 0} onClick={onBatchDownload}>
          {t.batchDownload}
        </Button>
        <Button type="button" size="sm" variant="danger" disabled={busy || selectedCount === 0} onClick={onBatchDelete}>
          {t.batchDelete}
        </Button>
      </div>
    </div>
  );
}
