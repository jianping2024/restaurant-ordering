'use client';

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from 'react';
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
  byItemDraftHasNamedRows,
  extractByItemDraftAllocations,
  extractByItemLockedAllocations,
  mergeByItemCommittedAndDraft,
  pruneByItemDraftAgainstLocks,
  type ByItemAllocationRows,
} from '@/lib/by-item-committed-draft';
import {
  allocationLockedTicketKeys,
  buildByItemConsumerRowsFromPersons,
  buildLockedPersonLineMins,
} from '@/lib/checkout-split-continuation';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { collectActiveConsumerNames } from '@/lib/consumer-name-roster';
import type { BillSplit, SplitMode } from '@/types';

/**
 * Sole *staff* checkout by-item editing state (person rail / pool).
 * Locked committed + unpaid named draft dual-layer — guest phone must not use this hook
 * (guest sole editor: useGuestByItemSplitState). Submit wire is still buildSplitPersonsFromAllocations.
 * Unpaid same-name tickets: sole heal {@link coalesceUnpaidSameNamePartyIds} on draft write / seed.
 */
export function useByItemSplitState(params: {
  splitMode: SplitMode | null;
  lineSpecs: ByItemLineSpec[];
  existingSplit: BillSplit | null;
  collectedPayments?: SessionCollectedPayment[];
  /** When false (guest bill page), skip staff dual-layer work. Default true. */
  enabled?: boolean;
}) {
  const {
    splitMode,
    lineSpecs,
    existingSplit,
    collectedPayments = [],
    enabled = true,
  } = params;

  const [draftAllocations, setDraftAllocations] = useState<ByItemAllocationRows>({});
  const seededSplitIdRef = useRef<string | null>(null);

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

  /** Persons hydrate → locked rows only. Realtime may rebuild; never touches draft. */
  const committedAllocations = useMemo(() => {
    if (!enabled || splitMode !== 'by_item') return {};
    if (!existingSplit?.persons?.length || lineSpecs.length === 0) return {};
    const fromPersons = buildByItemConsumerRowsFromPersons(
      existingSplit.persons,
      lineSpecs,
      paidLocks,
    );
    return extractByItemLockedAllocations(fromPersons, lockedTicketKeys);
  }, [enabled, splitMode, existingSplit, lineSpecs, paidLocks, lockedTicketKeys]);

  const committedRef = useRef(committedAllocations);
  committedRef.current = committedAllocations;
  const lockedKeysRef = useRef(lockedTicketKeys);
  lockedKeysRef.current = lockedTicketKeys;

  /**
   * Prune draft rows absorbed into locks; one-shot seed unlocked persons → draft
   * when this split has no named draft yet (continuation / remount).
   */
  useLayoutEffect(() => {
    if (!enabled || splitMode !== 'by_item') {
      seededSplitIdRef.current = null;
      return;
    }
    if (lineSpecs.length === 0) return;

    const splitId = existingSplit?.id ?? null;
    const persons = existingSplit?.persons;

    setDraftAllocations((prev) => {
      const pruned = pruneByItemDraftAgainstLocks(prev, lockedTicketKeys);

      if (splitId && seededSplitIdRef.current !== splitId) {
        seededSplitIdRef.current = splitId;
        if (!byItemDraftHasNamedRows(pruned) && persons?.length) {
          const fromPersons = buildByItemConsumerRowsFromPersons(
            persons,
            lineSpecs,
            paidLocks,
          );
          const coalesced = coalesceUnpaidSameNamePartyIds(fromPersons, lockedTicketKeys);
          const seed = extractByItemDraftAllocations(coalesced, lockedTicketKeys);
          if (Object.keys(seed).length > 0) return seed;
        }
      }

      return pruned === prev ? prev : pruned;
    });
  }, [enabled, splitMode, lockedTicketKeys, lineSpecs, existingSplit, paidLocks]);

  const byItemAllocations = useMemo(() => {
    if (!enabled || splitMode !== 'by_item') return {};
    return coalesceUnpaidSameNamePartyIds(
      withDefaultByItemLineRows(
        mergeByItemCommittedAndDraft(
          committedAllocations,
          draftAllocations,
          lockedTicketKeys,
        ),
        lineSpecs,
      ),
      lockedTicketKeys,
    );
  }, [
    enabled,
    splitMode,
    committedAllocations,
    draftAllocations,
    lockedTicketKeys,
    lineSpecs,
  ]);

  const setByItemAllocations = useCallback(
    (update: SetStateAction<Record<string, ByItemConsumerRow[]>>) => {
      if (!enabled) return;
      setDraftAllocations((prevDraft) => {
        const prevMerged = withDefaultByItemLineRows(
          mergeByItemCommittedAndDraft(
            committedRef.current,
            prevDraft,
            lockedKeysRef.current,
          ),
          lineSpecs,
        );
        const nextMerged =
          typeof update === 'function' ? update(prevMerged) : update;
        const coalesced = coalesceUnpaidSameNamePartyIds(
          nextMerged,
          lockedKeysRef.current,
        );
        return extractByItemDraftAllocations(coalesced, lockedKeysRef.current);
      });
    },
    [enabled, lineSpecs],
  );

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

  const rememberConsumerName: (name: string, fromList: boolean) => void =
    useCallback(() => {}, []);

  const renameByItemConsumer = useCallback(
    (oldName: string, newName: string, partyId?: string) => {
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
    },
    [setByItemAllocations],
  );

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
