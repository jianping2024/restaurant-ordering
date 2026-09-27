'use client';

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from 'react';
import {
  buildByItemAllocationsFromRows,
  buildSplitPersonsFromAllocations,
  countByItemAllocationProgress,
  normalizeByItemDraftPartyIds,
  withDefaultByItemLineRows,
  type ByItemConsumerRow,
  type ByItemLineAllocation,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import {
  extractByItemDraftAllocations,
  extractByItemLockedAllocations,
  mergeByItemCommittedAndDraft,
  mergeMissingByItemDraftTickets,
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
 * Party ids: sole normalize {@link normalizeByItemDraftPartyIds} on draft write / seed.
 *
 * Unpaid persons hydrate: sole path is {@link mergeMissingByItemDraftTickets} against
 * unlocked persons seed inside the derived working map (not a layout-effect setState) —
 * so Strict Mode / effect ordering cannot drop unpaid tickets while a locked chip is present.
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

  /**
   * Sole persons→rows hydrate for this split (locked + unlocked). Split into
   * committed / seed via extract* — do not call buildByItemConsumerRowsFromPersons twice.
   */
  const personsHydrateRows = useMemo(() => {
    if (!enabled || splitMode !== 'by_item') return {};
    if (!existingSplit?.persons?.length || lineSpecs.length === 0) return {};
    return buildByItemConsumerRowsFromPersons(
      existingSplit.persons,
      lineSpecs,
      paidLocks,
    );
  }, [enabled, splitMode, existingSplit, lineSpecs, paidLocks]);

  /** Persons hydrate → locked rows only. Realtime may rebuild; never touches draft. */
  const committedAllocations = useMemo(
    () => extractByItemLockedAllocations(personsHydrateRows, lockedTicketKeys),
    [personsHydrateRows, lockedTicketKeys],
  );

  /**
   * Unlocked persons → draft seed (idempotent). Merged into the working map every render
   * so unpaid tickets never depend on a layout-effect setState winning a race.
   */
  const unlockedPersonsSeed = useMemo(() => {
    const normalized = normalizeByItemDraftPartyIds(
      personsHydrateRows,
      lockedTicketKeys,
    );
    return extractByItemDraftAllocations(normalized, lockedTicketKeys);
  }, [personsHydrateRows, lockedTicketKeys]);

  const committedRef = useRef(committedAllocations);
  committedRef.current = committedAllocations;
  const lockedKeysRef = useRef(lockedTicketKeys);
  lockedKeysRef.current = lockedTicketKeys;
  const personsSeedRef = useRef(unlockedPersonsSeed);
  personsSeedRef.current = unlockedPersonsSeed;

  const draftWithPersons = useMemo(
    () =>
      mergeMissingByItemDraftTickets(
        pruneByItemDraftAgainstLocks(draftAllocations, lockedTicketKeys),
        unlockedPersonsSeed,
      ),
    [draftAllocations, unlockedPersonsSeed, lockedTicketKeys],
  );

  const byItemAllocations = useMemo(() => {
    if (!enabled || splitMode !== 'by_item') return {};
    return normalizeByItemDraftPartyIds(
      withDefaultByItemLineRows(
        mergeByItemCommittedAndDraft(
          committedAllocations,
          draftWithPersons,
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
    draftWithPersons,
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
            mergeMissingByItemDraftTickets(prevDraft, personsSeedRef.current),
            lockedKeysRef.current,
          ),
          lineSpecs,
        );
        const nextMerged =
          typeof update === 'function' ? update(prevMerged) : update;
        const normalized = normalizeByItemDraftPartyIds(
          nextMerged,
          lockedKeysRef.current,
        );
        return extractByItemDraftAllocations(normalized, lockedKeysRef.current);
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
