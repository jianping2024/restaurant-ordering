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
  normalizeByItemDraftPartyIds,
  withDefaultByItemLineRows,
  type ByItemConsumerRow,
  type ByItemLineAllocation,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import {
  byItemLineTicketOmitKey,
  byItemPersonsSeedShareSig,
  extractByItemDraftAllocations,
  extractByItemLockedAllocations,
  mergeByItemCommittedAndDraft,
  mergeMissingByItemDraftTickets,
  pruneByItemDraftAgainstLocks,
  reconcileByItemShareOmitKeys,
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
 * unlocked persons seed (with staff omit keys so trash / empty-qty commit stay gone).
 */
export function useByItemSplitState(params: {
  splitMode: SplitMode | null;
  lineSpecs: ByItemLineSpec[];
  existingSplit: BillSplit | null;
  collectedPayments?: SessionCollectedPayment[];
  /** When false (guest bill page), skip staff dual-layer work. Default true. */
  enabled?: boolean;
  /**
   * Sole session-isolation key for unpaid draft rows.
   * When it changes, wipe draft — never keep prior session's shares in the new session key.
   */
  draftOwnerKey?: string | null;
}) {
  const {
    splitMode,
    lineSpecs,
    existingSplit,
    collectedPayments = [],
    enabled = true,
    draftOwnerKey = null,
  } = params;

  const [draftAllocations, setDraftAllocations] = useState<ByItemAllocationRows>({});
  /** omitKey → persons-seed share sig at omit time (sole staff delete memory). */
  const [omitSigByKey, setOmitSigByKey] = useState<Map<string, string>>(() => new Map());

  useLayoutEffect(() => {
    setDraftAllocations({});
    setOmitSigByKey(new Map());
  }, [draftOwnerKey]);

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

  const reconciledOmitSigByKey = useMemo(
    () =>
      reconcileByItemShareOmitKeys({
        omitSigByKey,
        unlockedPersonsSeed,
      }),
    [omitSigByKey, unlockedPersonsSeed],
  );

  useLayoutEffect(() => {
    if (reconciledOmitSigByKey.size === omitSigByKey.size) {
      let same = true;
      for (const [key, sig] of reconciledOmitSigByKey) {
        if (omitSigByKey.get(key) !== sig) {
          same = false;
          break;
        }
      }
      if (same) return;
    }
    setOmitSigByKey(reconciledOmitSigByKey);
  }, [reconciledOmitSigByKey, omitSigByKey]);

  const omitLineTicketKeys = useMemo(
    () => new Set(reconciledOmitSigByKey.keys()),
    [reconciledOmitSigByKey],
  );

  const committedRef = useRef(committedAllocations);
  committedRef.current = committedAllocations;
  const lockedKeysRef = useRef(lockedTicketKeys);
  lockedKeysRef.current = lockedTicketKeys;
  const personsSeedRef = useRef(unlockedPersonsSeed);
  personsSeedRef.current = unlockedPersonsSeed;
  const omitKeysRef = useRef(omitLineTicketKeys);
  omitKeysRef.current = omitLineTicketKeys;

  const draftWithPersons = useMemo(
    () =>
      mergeMissingByItemDraftTickets(
        pruneByItemDraftAgainstLocks(draftAllocations, lockedTicketKeys),
        unlockedPersonsSeed,
        omitLineTicketKeys,
      ),
    [draftAllocations, unlockedPersonsSeed, lockedTicketKeys, omitLineTicketKeys],
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
            mergeMissingByItemDraftTickets(
              prevDraft,
              personsSeedRef.current,
              omitKeysRef.current,
            ),
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

  const recordStaffByItemShareOmit = useCallback(
    (lineKey: string, ticketKey: string) => {
      const omitKey = byItemLineTicketOmitKey(lineKey, ticketKey);
      const sig =
        byItemPersonsSeedShareSig(personsSeedRef.current, lineKey, ticketKey) ?? '';
      setOmitSigByKey((prev) => {
        if (prev.get(omitKey) === sig) return prev;
        const next = new Map(prev);
        next.set(omitKey, sig);
        return next;
      });
    },
    [],
  );

  const clearStaffByItemShareOmit = useCallback((lineKey: string, ticketKey: string) => {
    const omitKey = byItemLineTicketOmitKey(lineKey, ticketKey);
    setOmitSigByKey((prev) => {
      if (!prev.has(omitKey)) return prev;
      const next = new Map(prev);
      next.delete(omitKey);
      return next;
    });
  }, []);

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
    recordStaffByItemShareOmit,
    clearStaffByItemShareOmit,
  };
}
