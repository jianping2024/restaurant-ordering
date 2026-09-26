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
import {
  buildByItemConsumerRowsFromPersons,
  buildLockedPersonLineMins,
} from '@/lib/checkout-split-continuation';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { collectActiveConsumerNames } from '@/lib/consumer-name-roster';
import type { BillSplit, SplitMode } from '@/types';

export function useByItemSplitState(params: {
  splitMode: SplitMode | null;
  lineSpecs: ByItemLineSpec[];
  existingSplit: BillSplit | null;
  collectedPayments?: SessionCollectedPayment[];
}) {
  const { splitMode, lineSpecs, existingSplit, collectedPayments = [] } = params;

  const [byItemAllocations, setByItemAllocations] = useState<Record<string, ByItemConsumerRow[]>>({});
  const hydratedSplitKeyRef = useRef<string | null>(null);

  const paidLocks = useMemo(
    () =>
      buildLockedPersonLineMins(
        existingSplit,
        collectedPayments.length > 0,
        collectedPayments,
      ),
    [existingSplit, collectedPayments],
  );

  useLayoutEffect(() => {
    if (splitMode !== 'by_item') return;
    setByItemAllocations((prev) => {
      const next = withDefaultByItemLineRows(prev, lineSpecs);
      return next === prev ? prev : next;
    });
  }, [splitMode, lineSpecs]);

  useLayoutEffect(() => {
    if (splitMode !== 'by_item' || !existingSplit?.persons?.length) return;
    // Wait for lineSpecs — hydrating with [] stamps the split id and skips the real restore.
    if (lineSpecs.length === 0) return;
    const personsSig = JSON.stringify(existingSplit.persons);
    const lockSig = `${paidLocks.menu.size}:${paidLocks.buffet.size}`;
    const hydrateKey = `${existingSplit.id}:${lineSpecs.map((spec) => spec.key).join('|')}:${personsSig}:${lockSig}`;
    if (hydratedSplitKeyRef.current === hydrateKey) return;
    hydratedSplitKeyRef.current = hydrateKey;
    const hydrated = buildByItemConsumerRowsFromPersons(
      existingSplit.persons,
      lineSpecs,
      paidLocks,
    );
    setByItemAllocations(withDefaultByItemLineRows(hydrated, lineSpecs));
  }, [splitMode, lineSpecs, existingSplit, paidLocks]);

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

  const renameByItemConsumer = useCallback((
    oldName: string,
    newName: string,
    partyId?: string,
  ) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setByItemAllocations((prev) => {
      const next: Record<string, ByItemConsumerRow[]> = {};
      for (const [key, rows] of Object.entries(prev)) {
        next[key] = rows.map((row) => {
          if (partyId?.trim()) {
            if (row.partyId?.trim() !== partyId.trim()) return row;
            return { ...row, name: trimmed };
          }
          if (row.name.trim().toLowerCase() !== oldName.toLowerCase()) return row;
          return { ...row, name: trimmed };
        });
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
