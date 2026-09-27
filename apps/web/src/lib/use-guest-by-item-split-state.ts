'use client';

/**
 * Sole guest (customer phone) by-item *editing* state.
 * Dish-row model: unnamed payer slots + add-consumer must persist in working map.
 * Does not use staff committed/draft dual-layer (that is staff-only).
 * Submit still goes through buildSplitPersonsFromAllocations → same bill wire as staff.
 * Unpaid same-name tickets: sole heal {@link coalesceUnpaidSameNamePartyIds} on every write.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import {
  buildByItemAllocationsFromRows,
  buildSplitPersonsFromAllocations,
  coalesceUnpaidSameNamePartyIds,
  countByItemAllocationProgress,
  withDefaultByItemLineRows,
  type ByItemConsumerRow,
  type ByItemLineAllocation,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import {
  allocationLockedTicketKeys,
  buildByItemConsumerRowsFromPersons,
  buildLockedPersonLineMins,
} from '@/lib/checkout-split-continuation';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { collectActiveConsumerNames } from '@/lib/consumer-name-roster';
import type { BillSplit, SplitMode } from '@/types';

export function useGuestByItemSplitState(params: {
  splitMode: SplitMode | null;
  lineSpecs: ByItemLineSpec[];
  existingSplit: BillSplit | null;
  collectedPayments?: SessionCollectedPayment[];
  /** When false (staff draft page), skip all guest editor work. */
  enabled?: boolean;
}) {
  const {
    splitMode,
    lineSpecs,
    existingSplit,
    collectedPayments = [],
    enabled = true,
  } = params;

  const [byItemAllocations, setByItemAllocationsState] = useState<Record<string, ByItemConsumerRow[]>>({});
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

  const lockedTicketKeys = useMemo(
    () => allocationLockedTicketKeys(existingSplit, collectedPayments),
    [existingSplit, collectedPayments],
  );
  const lockedTicketKeysRef = useRef(lockedTicketKeys);
  lockedTicketKeysRef.current = lockedTicketKeys;

  const setByItemAllocations = useCallback(
    (update: SetStateAction<Record<string, ByItemConsumerRow[]>>) => {
      if (!enabled) return;
      setByItemAllocationsState((prev) => {
        const raw = typeof update === 'function' ? update(prev) : update;
        return coalesceUnpaidSameNamePartyIds(raw, lockedTicketKeysRef.current);
      });
    },
    [enabled],
  );

  useLayoutEffect(() => {
    if (!enabled || splitMode !== 'by_item') return;
    setByItemAllocationsState((prev) => {
      const withDefaults = withDefaultByItemLineRows(prev, lineSpecs);
      const next = coalesceUnpaidSameNamePartyIds(withDefaults, lockedTicketKeys);
      return next === prev ? prev : next;
    });
  }, [enabled, splitMode, lineSpecs, lockedTicketKeys]);

  useLayoutEffect(() => {
    if (!enabled || splitMode !== 'by_item' || !existingSplit?.persons?.length) return;
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
    setByItemAllocationsState(
      coalesceUnpaidSameNamePartyIds(
        withDefaultByItemLineRows(hydrated, lineSpecs),
        lockedTicketKeys,
      ),
    );
  }, [enabled, splitMode, lineSpecs, existingSplit, paidLocks, lockedTicketKeys]);

  const workingAllocations = useMemo(
    () => (enabled ? byItemAllocations : {}),
    [enabled, byItemAllocations],
  );

  const consumerRoster = useMemo(
    () => collectActiveConsumerNames(workingAllocations),
    [workingAllocations],
  );

  const parsedByItemAllocations = useMemo<ByItemLineAllocation>(
    () => buildByItemAllocationsFromRows(lineSpecs, workingAllocations),
    [lineSpecs, workingAllocations],
  );

  const byItemProgress = useMemo(
    () => countByItemAllocationProgress(lineSpecs, workingAllocations),
    [lineSpecs, workingAllocations],
  );

  const rememberConsumerName: (name: string, fromList: boolean) => void =
    useCallback(() => {}, []);

  const renameByItemConsumer = useCallback((
    oldName: string,
    newName: string,
    partyId?: string,
  ) => {
    if (!enabled) return;
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
  }, [enabled, setByItemAllocations]);

  const buildPersonsForSubmit = useCallback(
    () => buildSplitPersonsFromAllocations(parsedByItemAllocations),
    [parsedByItemAllocations],
  );

  return {
    byItemAllocations: workingAllocations,
    setByItemAllocations,
    consumerRoster,
    rememberConsumerName,
    parsedByItemAllocations,
    byItemProgress,
    renameByItemConsumer,
    buildPersonsForSubmit,
  };
}
