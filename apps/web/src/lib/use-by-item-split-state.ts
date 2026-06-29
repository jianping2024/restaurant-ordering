'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  buildByItemAllocationsFromRows,
  buildSplitPersonsFromAllocations,
  countByItemAllocationProgress,
  withDefaultByItemLineRows,
  type ByItemConsumerRow,
  type ByItemLineAllocation,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { buildByItemConsumerRowsFromPersons } from '@/lib/checkout-split-continuation';
import { collectActiveConsumerNames } from '@/lib/consumer-name-roster';
import type { BillSplit, SplitMode } from '@/types';

export function useByItemSplitState(params: {
  splitMode: SplitMode | null;
  lineSpecs: ByItemLineSpec[];
  existingSplit: BillSplit | null;
}) {
  const { splitMode, lineSpecs, existingSplit } = params;

  const [byItemAllocations, setByItemAllocations] = useState<Record<string, ByItemConsumerRow[]>>({});
  const hydratedSplitIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (splitMode !== 'by_item') return;
    setByItemAllocations((prev) => {
      const next = withDefaultByItemLineRows(prev, lineSpecs);
      return next === prev ? prev : next;
    });
  }, [splitMode, lineSpecs]);

  useLayoutEffect(() => {
    if (splitMode !== 'by_item' || !existingSplit?.persons?.length) return;
    if (hydratedSplitIdRef.current === existingSplit.id) return;
    hydratedSplitIdRef.current = existingSplit.id;
    const hydrated = buildByItemConsumerRowsFromPersons(existingSplit.persons, lineSpecs);
    setByItemAllocations(withDefaultByItemLineRows(hydrated, lineSpecs));
  }, [splitMode, lineSpecs, existingSplit]);

  const consumerRoster = useMemo(
    () => collectActiveConsumerNames(byItemAllocations),
    [byItemAllocations],
  );

  const parsedByItemAllocations = useMemo<ByItemLineAllocation>(
    () => buildByItemAllocationsFromRows(lineSpecs, byItemAllocations),
    [lineSpecs, byItemAllocations],
  );

  const byItemProgress = useMemo(
    () => countByItemAllocationProgress(lineSpecs, byItemAllocations),
    [lineSpecs, byItemAllocations],
  );

  const rememberConsumerName: (name: string, fromList: boolean) => void = useCallback(() => {}, []);

  const renameByItemConsumer = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
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
