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
 * Sole by-item UI state: locked committed (persons) + unpaid draft (local only).
 * Display map is the merge; setByItemAllocations writes draft only.
 * Unlocked persons seed draft once per split id — never live in committed.
 */
export function useByItemSplitState(params: {
  splitMode: SplitMode | null;
  lineSpecs: ByItemLineSpec[];
  existingSplit: BillSplit | null;
  collectedPayments?: SessionCollectedPayment[];
}) {
  const { splitMode, lineSpecs, existingSplit, collectedPayments = [] } = params;

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
    if (splitMode !== 'by_item') return {};
    if (!existingSplit?.persons?.length || lineSpecs.length === 0) return {};
    const fromPersons = buildByItemConsumerRowsFromPersons(
      existingSplit.persons,
      lineSpecs,
      paidLocks,
    );
    return extractByItemLockedAllocations(fromPersons, lockedTicketKeys);
  }, [splitMode, existingSplit, lineSpecs, paidLocks, lockedTicketKeys]);

  const committedRef = useRef(committedAllocations);
  committedRef.current = committedAllocations;
  const lockedKeysRef = useRef(lockedTicketKeys);
  lockedKeysRef.current = lockedTicketKeys;

  /**
   * Prune draft rows absorbed into locks; one-shot seed unlocked persons → draft
   * when this split has no named draft yet (continuation / remount).
   */
  useLayoutEffect(() => {
    if (splitMode !== 'by_item') {
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
          const seed = extractByItemDraftAllocations(fromPersons, lockedTicketKeys);
          if (Object.keys(seed).length > 0) return seed;
        }
      }

      return pruned === prev ? prev : pruned;
    });
  }, [splitMode, lockedTicketKeys, lineSpecs, existingSplit, paidLocks]);

  const byItemAllocations = useMemo(() => {
    if (splitMode !== 'by_item') return {};
    return withDefaultByItemLineRows(
      mergeByItemCommittedAndDraft(
        committedAllocations,
        draftAllocations,
        lockedTicketKeys,
      ),
      lineSpecs,
    );
  }, [
    splitMode,
    committedAllocations,
    draftAllocations,
    lockedTicketKeys,
    lineSpecs,
  ]);

  const setByItemAllocations = useCallback(
    (update: SetStateAction<Record<string, ByItemConsumerRow[]>>) => {
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
        return extractByItemDraftAllocations(nextMerged, lockedKeysRef.current);
      });
    },
    [lineSpecs],
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
