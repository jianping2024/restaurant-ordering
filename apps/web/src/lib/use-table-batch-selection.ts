'use client';

import { useCallback, useMemo, useState } from 'react';

export function useTableBatchSelection() {
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const selectedCount = selectedIds.size;

  const enterBatchMode = useCallback(() => {
    setBatchMode(true);
  }, []);

  const exitBatchMode = useCallback(() => {
    setBatchMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleBatchMode = useCallback(() => {
    if (batchMode) {
      exitBatchMode();
      return;
    }
    enterBatchMode();
  }, [batchMode, enterBatchMode, exitBatchMode]);

  const toggleRow = useCallback((tableId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  }, []);

  const selectPage = useCallback((tableIds: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of tableIds) next.add(id);
      return next;
    });
  }, []);

  const deselectPage = useCallback((tableIds: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of tableIds) next.delete(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const resetAfterDelete = useCallback(() => {
    exitBatchMode();
  }, [exitBatchMode]);

  const selection = useMemo(() => selectedIds, [selectedIds]);

  return {
    batchMode,
    selectedIds: selection,
    selectedCount,
    enterBatchMode,
    exitBatchMode,
    toggleBatchMode,
    toggleRow,
    selectPage,
    deselectPage,
    clearSelection,
    resetAfterDelete,
  };
}
