'use client';

import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  buildByItemAllocationsFromRows,
  buildSplitPersonsFromAllocations,
  countByItemAllocationProgress,
  withDefaultByItemLineRows,
  type ByItemConsumerRow,
  type ByItemLineAllocation,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { addToConsumerRoster, rememberConsumerName as rememberConsumerNameInRoster } from '@/lib/consumer-name-roster';
import type { BillSplit, SplitMode } from '@/types';

export function useByItemSplitState(params: {
  splitMode: SplitMode | null;
  lineSpecs: ByItemLineSpec[];
  existingSplit: BillSplit | null;
}) {
  const { splitMode, lineSpecs, existingSplit } = params;

  const [byItemAllocations, setByItemAllocations] = useState<Record<string, ByItemConsumerRow[]>>({});
  const [consumerRoster, setConsumerRoster] = useState<string[]>(() => {
    if (!existingSplit || existingSplit.split_mode !== 'by_item') return [];
    return (existingSplit.persons ?? []).reduce(
      (roster, person) => addToConsumerRoster(roster, person.name),
      [] as string[],
    );
  });

  useLayoutEffect(() => {
    if (splitMode !== 'by_item') return;
    setByItemAllocations((prev) => {
      const next = withDefaultByItemLineRows(prev, lineSpecs);
      return next === prev ? prev : next;
    });
  }, [splitMode, lineSpecs]);

  const parsedByItemAllocations = useMemo<ByItemLineAllocation>(
    () => buildByItemAllocationsFromRows(lineSpecs, byItemAllocations),
    [lineSpecs, byItemAllocations],
  );

  const byItemProgress = useMemo(
    () => countByItemAllocationProgress(lineSpecs, byItemAllocations),
    [lineSpecs, byItemAllocations],
  );

  const rememberConsumerName = useCallback((name: string, fromList: boolean) => {
    setConsumerRoster((prev) => rememberConsumerNameInRoster(prev, name, fromList));
  }, []);

  const renameByItemConsumer = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setConsumerRoster((prev) => {
      const withoutOld = prev.filter((name) => name.toLowerCase() !== oldName.toLowerCase());
      return rememberConsumerNameInRoster(withoutOld, trimmed, true);
    });
    setByItemAllocations((prev) => {
      const next: Record<string, ByItemConsumerRow[]> = {};
      for (const [key, rows] of Object.entries(prev)) {
        next[key] = rows.map((row) => (
          row.name.trim().toLowerCase() === oldName.toLowerCase()
            ? { ...row, name: trimmed }
            : row
        ));
      }
      return next;
    });
  }, []);

  const buildPersonsForSubmit = useCallback(
    () => buildSplitPersonsFromAllocations(parsedByItemAllocations),
    [parsedByItemAllocations],
  );

  return {
    byItemAllocations,
    setByItemAllocations,
    consumerRoster,
    rememberConsumerName,
    parsedByItemAllocations,
    byItemProgress,
    renameByItemConsumer,
    buildPersonsForSubmit,
  };
}
